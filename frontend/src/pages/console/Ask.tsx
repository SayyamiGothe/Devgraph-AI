import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ConsoleShell } from '../../components/console/ConsoleShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useConsoleData } from '../../context/ConsoleDataContext'
import { readErrorMessage, useApi } from '../../hooks/useApi'
import { api, type ChatMessage, type RagSource } from '../../lib/api'
import { Link, useNumericParam, useSearchParams } from '../../router'

/** A locally-added message that has no server id yet. */
let localId = -1

export function Ask() {
  const { loading, projects, documentsOf } = useConsoleData()
  const projectFromUrl = useNumericParam('project')
  const initialQuestion = useSearchParams().get('q') ?? ''

  const [projectId, setProjectId] = useState<number | null>(projectFromUrl)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sources, setSources] = useState<RagSource[]>([])
  const [question, setQuestion] = useState(initialQuestion)
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (projectId !== null || projects.length === 0) return
    setProjectId(projectFromUrl ?? projects[0].id)
  }, [projectId, projectFromUrl, projects])

  // Conversations for the selected project.
  const conversations = useApi(
    `conversations:${projectId}`,
    (signal) => api.conversations.listByProject(projectId as number, signal),
    projectId !== null,
  )

  // Pick the newest conversation once the list arrives.
  useEffect(() => {
    const list = conversations.data
    if (!list) return
    setConversationId((current) => {
      if (current !== null && list.some((item) => item.id === current)) return current
      return list[0]?.id ?? null
    })
  }, [conversations.data])

  // History for the selected conversation.
  const history = useApi(
    `messages:${conversationId}`,
    (signal) => api.chat.messages(conversationId as number, signal),
    conversationId !== null,
  )

  useEffect(() => {
    setMessages(history.data ?? [])
    setSources([])
  }, [history.data])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, asking])

  const project = projects.find((item) => item.id === projectId) ?? null
  const documentCount = projectId === null ? 0 : documentsOf(projectId).length

  const conversationList = useMemo(() => conversations.data ?? [], [conversations.data])

  const startConversation = async (title?: string) => {
    if (projectId === null) return null

    const created = await api.conversations.create(projectId, title ?? null)
    conversations.reload()
    setConversationId(created.id)
    setMessages([])
    setSources([])
    return created.id
  }

  const ask = async (event: FormEvent) => {
    event.preventDefault()

    const text = question.trim()
    if (!text || asking || projectId === null) return

    setError(null)
    setAsking(true)
    setQuestion('')

    // Show the question immediately; the server persists it as part of /rag/ask.
    setMessages((current) => [
      ...current,
      { id: localId--, conversation_id: conversationId ?? 0, role: 'user', content: text },
    ])

    try {
      // A conversation is required by POST /rag/ask, so open one on first ask.
      const targetConversation =
        conversationId ?? (await startConversation(text.slice(0, 60)))

      if (targetConversation === null) throw new Error('Could not open a conversation.')

      const answer = await api.rag.ask({
        question: text,
        projectId,
        conversationId: targetConversation,
      })

      setMessages((current) => [
        ...current,
        {
          id: localId--,
          conversation_id: targetConversation,
          role: 'assistant',
          content: answer.answer,
        },
      ])
      setSources(answer.sources)
    } catch (err) {
      setError(readErrorMessage(err, 'The question could not be answered.'))
      // Drop the optimistic question — the server may not have stored it.
      setMessages((current) => current.filter((message) => message.content !== text || message.id > 0))
      setQuestion(text)
    } finally {
      setAsking(false)
    }
  }

  return (
    <ConsoleShell title="Ask" subtitle="Retrieval-augmented answers over your own documents.">
      {loading && (
        <div className="console__loading animate-in">
          <Spinner size={20} label="Loading projects" />
          <span>Loading projects…</span>
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="empty-state animate-in">
          <span aria-hidden="true">⧉</span>
          <h3>Nothing to ask about yet</h3>
          <p>
            Create a project on <Link to="/app/workspaces">Workspaces</Link>, then upload files on{' '}
            <Link to="/app/documents">Documents</Link>.
          </p>
        </div>
      )}

      {projects.length > 0 && (
        <>
          <div className="console__toolbar animate-in">
            <label className="select">
              <span>Project</span>
              <select
                value={projectId ?? ''}
                onChange={(event) => {
                  setProjectId(Number(event.target.value))
                  setConversationId(null)
                  setMessages([])
                  setSources([])
                }}
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="select">
              <span>Conversation</span>
              <select
                value={conversationId ?? ''}
                onChange={(event) => setConversationId(Number(event.target.value))}
                disabled={conversationList.length === 0}
              >
                {conversationList.length === 0 && <option value="">No conversations yet</option>}
                {conversationList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title ?? `Conversation #${item.id}`}
                  </option>
                ))}
              </select>
            </label>

            <Button
              size="sm"
              variant="outline"
              iconLeft={<span aria-hidden="true">＋</span>}
              onClick={() => startConversation()}
            >
              New chat
            </Button>

            <span className="console__count text-mono">
              {documentCount} docs indexed
            </span>
          </div>

          {(error || conversations.error || history.error) && (
            <div className="alert animate-in">
              <span aria-hidden="true">⚠</span>
              <span>{error ?? conversations.error ?? history.error}</span>
            </div>
          )}

          {documentCount === 0 && (
            <div className="alert alert--info animate-in">
              <span aria-hidden="true">ℹ</span>
              <span>
                <strong>{project?.name}</strong> has no documents, so answers will come back empty.{' '}
                <Link to={`/app/documents?project=${projectId}`}>Upload one first.</Link>
              </span>
            </div>
          )}

          <section className="chat animate-in">
            <div className="chat__thread" ref={threadRef}>
              {history.loading && (
                <div className="console__loading">
                  <Spinner size={18} label="Loading messages" />
                  <span>Loading history…</span>
                </div>
              )}

              {!history.loading && messages.length === 0 && (
                <div className="empty-state">
                  <span aria-hidden="true">⁂</span>
                  <h3>Ask anything about {project?.name ?? 'this project'}</h3>
                  <p>Answers cite the chunks they came from.</p>
                </div>
              )}

              {messages.map((message) => (
                <article className={`chat__msg is-${message.role}`} key={message.id}>
                  <span className="chat__role">{message.role === 'user' ? 'You' : 'DevGraph'}</span>
                  <p>{message.content}</p>
                </article>
              ))}

              {asking && (
                <article className="chat__msg is-assistant is-pending">
                  <span className="chat__role">DevGraph</span>
                  <p>
                    <Spinner size={14} /> Retrieving chunks and generating an answer…
                  </p>
                </article>
              )}
            </div>

            {sources.length > 0 && (
              <div className="chat__sources">
                <span className="chat__sources-label">Sources</span>
                {sources.map((source) => (
                  <Badge key={`${source.document_id}-${source.chunk_id}`} tone="cyan">
                    {source.document_name} · chunk {source.chunk_index}
                  </Badge>
                ))}
              </div>
            )}

            <form className="chat__composer" onSubmit={ask}>
              <input
                value={question}
                placeholder="Which contracts renew before Q4 and mention data residency?"
                aria-label="Your question"
                onChange={(event) => setQuestion(event.target.value)}
              />
              <Button type="submit" loading={asking} disabled={!question.trim()}>
                Ask
              </Button>
            </form>
          </section>

          <p className="console__note">
            <code>POST /rag/ask</code> with the selected project and conversation; history comes
            from <code>GET /chat-messages/conversation/&#123;id&#125;</code>.
          </p>
        </>
      )}
    </ConsoleShell>
  )
}
