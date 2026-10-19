import { useEffect, useState } from 'react'
import {
  GitCommitHorizontal,
  GitBranch,
  RefreshCw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { GitHistory } from '../../shared/contracts'
import { api, errorMessage } from './api'
import { Button } from './components/ui/button'

export function GitPanel({ conversationId }: { conversationId: string }) {
  const [history, setHistory] = useState<GitHistory>(),
    [error, setError] = useState(''),
    [skip, setSkip] = useState(0),
    [revision, setRevision] = useState(''),
    [diff, setDiff] = useState<{ text: string; truncated: boolean }>(),
    [refresh, setRefresh] = useState(0),
    [details, setDetails] = useState<{ branches: string[]; conflicts: string[] }>(),
    [busy, setBusy] = useState(false),
    [branchName, setBranchName] = useState(''),
    [mergeBranch, setMergeBranch] = useState(''),
    [commitMessage, setCommitMessage] = useState(''),
    [output, setOutput] = useState('')
  async function act(body: Record<string, string>) {
    if (busy) return
    setBusy(true)
    setError('')
    setOutput('')
    try {
      const result = await api<{ output: string }>(
        `/conversations/${conversationId}/git/action`,
        body,
      )
      setOutput(result.output || 'Operation completed.')
      if (body.action === 'commit') setCommitMessage('')
      if (body.action === 'branch') setBranchName('')
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
      setRefresh((value) => value + 1)
    }
  }
  useEffect(() => {
    let current = true
    setDetails(undefined)
    void api<{ branches: string[]; conflicts: string[] }>(
      `/conversations/${conversationId}/git/details`,
    )
      .then((data) => {
        if (current) setDetails(data)
      })
      .catch((error) => {
        if (current) setError(errorMessage(error))
      })
    return () => {
      current = false
    }
  }, [conversationId, refresh])
  useEffect(() => {
    let current = true
    setError('')
    void api<GitHistory>(`/conversations/${conversationId}/git?skip=${skip}`)
      .then((data) => {
        if (current) setHistory(data)
      })
      .catch((error) => {
        if (current) setError(errorMessage(error))
      })
    return () => {
      current = false
    }
  }, [conversationId, skip, refresh])
  useEffect(() => {
    if (!revision) return
    let current = true
    setDiff(undefined)
    setError('')
    void api<{ text: string; truncated: boolean }>(
      `/conversations/${conversationId}/diff?revision=${encodeURIComponent(revision)}`,
    )
      .then((data) => {
        if (current) setDiff(data)
      })
      .catch((error) => {
        if (current) setError(errorMessage(error))
      })
    return () => {
      current = false
    }
  }, [conversationId, revision, refresh])
  return (
    <div className="git-panel">
      <div className="git-toolbar">
        {revision ? (
          <Button variant="ghost" size="small" onClick={() => setRevision('')}>
            <ArrowLeft size={14} />
            History
          </Button>
        ) : (
          <span>
            <GitBranch size={15} />
            Current branch: {history?.branch || 'Loading…'}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh history"
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={14} />
        </Button>
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {output && (
        <pre role="status" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {output}
        </pre>
      )}
      {revision ? (
        <div className="diff-view">
          {!diff ? (
            <p className="muted">Loading changes…</p>
          ) : (
            <>
              {diff.truncated && (
                <p className="field-note">
                  Preview limited to 2 MB. The remaining changes are available in Git.
                </p>
              )}
              <pre>
                {diff.text
                  ? diff.text.split('\n').map((line, index) => (
                      <div
                        key={index}
                        data-kind={
                          line.startsWith('+')
                            ? 'add'
                            : line.startsWith('-')
                              ? 'remove'
                              : line.startsWith('@@')
                                ? 'section'
                                : 'context'
                        }
                      >
                        {line || ' '}
                      </div>
                    ))
                  : 'No changes in this view. Untracked files do not have a diff yet.'}
              </pre>
            </>
          )}
        </div>
      ) : (
        <div className="git-content">
          {history && (
            <>
              <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
                <legend className="section-label">REPOSITORY ACTIONS</legend>
                <div className="change-actions">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => void act({ action: 'fetch' })}
                  >
                    Fetch
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => void act({ action: 'pull' })}
                  >
                    Pull (fast-forward only)
                  </Button>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void act({ action: 'branch', name: branchName })
                  }}
                >
                  <label>
                    New branch
                    <input
                      value={branchName}
                      maxLength={150}
                      onChange={(event) => setBranchName(event.target.value)}
                    />
                  </label>
                  <Button size="small" type="submit" disabled={!branchName.trim()}>
                    Create and switch branch
                  </Button>
                </form>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void act({ action: 'merge', branch: mergeBranch })
                  }}
                >
                  <label>
                    Branch to merge
                    <select
                      value={mergeBranch}
                      onChange={(event) => setMergeBranch(event.target.value)}
                    >
                      <option value="">Select a branch</option>
                      {details?.branches
                        .filter((branch) => branch !== history.branch)
                        .map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Button
                    size="small"
                    type="submit"
                    disabled={!mergeBranch || !!details?.conflicts.length}
                  >
                    Merge without committing
                  </Button>
                </form>
                {!!details?.conflicts.length && (
                  <p role="status">
                    Resolve conflict markers in your editor, then mark each file resolved below.
                    Review the staged diff before committing.
                  </p>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void act({ action: 'commit', message: commitMessage })
                  }}
                >
                  <label>
                    Commit message
                    <textarea
                      value={commitMessage}
                      maxLength={10000}
                      onChange={(event) => setCommitMessage(event.target.value)}
                    />
                  </label>
                  <Button
                    size="small"
                    type="submit"
                    disabled={!commitMessage.trim() || !details || !!details.conflicts.length}
                  >
                    Commit staged changes
                  </Button>
                </form>
                {busy && <p role="status">Running Git operation…</p>}
              </fieldset>
              <div className="section-label">
                LOCAL CHANGES <span>{history.changes.length}</span>
              </div>
              {history.changes.length ? (
                <>
                  <div className="change-actions">
                    <Button variant="secondary" size="small" onClick={() => setRevision('working')}>
                      Unstaged diff
                    </Button>
                    <Button variant="secondary" size="small" onClick={() => setRevision('staged')}>
                      Staged diff
                    </Button>
                  </div>
                  <ul className="changed-files">
                    {history.changes.slice(0, 100).map((item) => (
                      <li key={item.path}>
                        <code>{item.status}</code>
                        <span title={item.path}>{item.path}</span>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={busy || !details}
                          onClick={() =>
                            void act({
                              action: details?.conflicts.includes(item.path) ? 'resolve' : 'stage',
                              path: item.path,
                            })
                          }
                        >
                          {details?.conflicts.includes(item.path) ? 'Mark resolved' : 'Stage'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {history.changes.length > 100 && (
                    <p className="field-note">Showing the first 100 files.</p>
                  )}
                </>
              ) : (
                <p className="clean-state">Your working tree is clean.</p>
              )}
              <div className="section-label">COMMIT HISTORY</div>
              <div className="commit-list">
                {history.commits.map((commit) => (
                  <button
                    key={commit.hash}
                    className="commit"
                    onClick={() => setRevision(commit.hash)}
                  >
                    <span className="commit-node">
                      <GitCommitHorizontal size={20} />
                    </span>
                    <span>
                      <strong>{commit.subject}</strong>
                      <span className="commit-meta">
                        {commit.author} · {new Date(commit.date).toLocaleDateString()}
                        <code>{commit.shortHash}</code>
                      </span>
                    </span>
                  </button>
                ))}
                {!history.commits.length && <p className="muted">No commits yet.</p>}
              </div>
              <div className="pagination">
                <Button
                  variant="ghost"
                  size="small"
                  disabled={!skip}
                  onClick={() => setSkip((value) => Math.max(0, value - 50))}
                >
                  <ChevronLeft size={14} />
                  Previous
                </Button>
                <span>
                  {skip + 1}–{skip + history.commits.length}
                </span>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={!history.hasMore}
                  onClick={() => setSkip((value) => value + 50)}
                >
                  Next
                  <ChevronRight size={14} />
                </Button>
              </div>
            </>
          )}
          {!history && !error && <p className="muted">Loading history…</p>}
        </div>
      )}
    </div>
  )
}
