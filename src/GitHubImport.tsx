import { useEffect, useRef, useState, type FormEvent } from "react";
import { ExternalLink, GitBranch, LoaderCircle, X } from "lucide-react";
import { importPublicGitHubRepository, type GitHubImportResult, type ImportProgress } from "./github";

type Props = {
  onImported: (result: GitHubImportResult) => void;
  onBusyChange: (busy: boolean) => void;
};

export default function GitHubImport({ onImported, onBusyChange }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setProgress(null);
    setSuccess("");
    setError("Import cancelled.");
    onBusyChange(false);
  }

  async function importRepo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim() || busy) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError("");
    setSuccess("");
    setProgress(null);
    onBusyChange(true);
    try {
      const result = await importPublicGitHubRepository(url, {
        signal: current.signal,
        onProgress: value => {
          if (controller.current === current && !current.signal.aborted) setProgress(value);
        }
      });
      if (current.signal.aborted) return;
      onImported(result);
      setSuccess("Imported " + result.files.length + " source files from " + result.fullName + ".");
    } catch (failure) {
      if (!current.signal.aborted) {
        setError(failure instanceof Error ? failure.message : "Could not import this repository.");
      }
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setBusy(false);
        setProgress(null);
        onBusyChange(false);
      }
    }
  }

  return (
    <div className="github-import">
      <div className="section-head remote-section"><span>PUBLIC GITHUB REPOSITORY</span><ExternalLink size={13}/></div>
      <form onSubmit={event => void importRepo(event)}>
        <label className="sr-only" htmlFor="github-repository-url">GitHub repository URL</label>
        <input
          id="github-repository-url"
          className="github-input"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          value={url}
          disabled={busy}
          onChange={event => setUrl(event.target.value)}
          placeholder="github.com/owner/repo"
          aria-describedby="github-import-help"
        />
        <div id="github-import-help" className="github-import-help">
          Public repositories only · No token required
        </div>
        {busy ? (
          <button className="secondary github-cancel" type="button" onClick={cancel}>
            <X size={15}/> Cancel import
          </button>
        ) : (
          <button className="primary github-submit" type="submit" disabled={!url.trim()}>
            <GitBranch size={16}/> Analyze GitHub repo
          </button>
        )}
      </form>
      {busy && (
        <div className="import-progress" role="status" aria-live="polite">
          <LoaderCircle size={13} className="spinner"/>
          {progress?.phase === "reading" ? (
            <span>Reading files {progress.completed}/{progress.total}</span>
          ) : <span>Reading repository metadata…</span>}
        </div>
      )}
      {error && <div role="alert" className="github-feedback github-error">{error}</div>}
      {success && !busy && <div role="status" className="github-feedback github-success">{success}</div>}
    </div>
  );
}
