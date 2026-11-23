import { useEffect, useRef, useState, type FormEvent } from "react";
import { Github, LoaderCircle, Search, X } from "lucide-react";
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

  useEffect(() => () => {
    controller.current?.abort();
    onBusyChange(false);
  }, [onBusyChange]);

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
      setSuccess("Ready! Analyzed " + result.files.length + " files from " + result.fullName + ".");
      document.getElementById("architecture")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <form className="repo-import-form" onSubmit={event => void importRepo(event)}>
        <label className="repo-input-wrap" htmlFor="github-repository-url">
          <Github size={22} aria-hidden="true" />
          <input
            id="github-repository-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            value={url}
            disabled={busy}
            onChange={event => setUrl(event.target.value)}
            placeholder="https://github.com/owner/repo"
            aria-describedby="github-import-help"
          />
        </label>
        {busy ? (
          <button className="glass-button" type="button" onClick={cancel}><X size={17} /> Cancel</button>
        ) : (
          <button className="gradient-button" type="submit" disabled={!url.trim()}>
            <Search size={18} /> Analyze repository
          </button>
        )}
      </form>
      <p id="github-import-help" className="import-helper">Public repositories only · No GitHub token · Analyzed in your browser</p>
      {busy && (
        <div className="import-progress" role="status" aria-live="polite">
          <LoaderCircle size={16} className="spinner" />
          {progress?.phase === "reading" ? (
            <span>Reading source files: {progress.completed}/{progress.total}</span>
          ) : <span>Connecting to GitHub and reading repository metadata…</span>}
        </div>
      )}
      {error && <div role="alert" className="github-feedback github-error">{error}</div>}
      {success && !busy && <div role="status" className="github-feedback github-success">{success}</div>}
    </div>
  );
}
