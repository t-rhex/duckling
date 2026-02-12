import { createSignal } from "solid-js";
import { Button } from "@/components/ui/Button";
import { apiUrl, setApiUrl } from "@/stores/settings";
import { fetchHealth } from "@/services/api";
import "./SettingsForm.css";

export function SettingsForm() {
  const [url, setUrl] = createSignal(apiUrl());
  const [testing, setTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal<{ ok: boolean; message: string } | null>(null);

  function handleSave() {
    setApiUrl(url());
    setTestResult({ ok: true, message: "Saved" });
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const prev = apiUrl();
    setApiUrl(url());
    try {
      const data = await fetchHealth();
      setTestResult({
        ok: true,
        message: `Connected — ${data.status}`,
      });
    } catch (e) {
      setApiUrl(prev);
      setTestResult({
        ok: false,
        message: e instanceof Error ? e.message : "Connection failed",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div class="settings-form">
      <div class="form-group">
        <label class="form-label">API URL</label>
        <input
          class="form-input"
          type="url"
          placeholder="http://localhost:8000"
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
        />
      </div>

      <div class="settings-actions">
        <Button variant="primary" size="md" onClick={handleSave}>
          Save
        </Button>
        <Button variant="ghost" size="md" disabled={testing()} onClick={handleTest}>
          {testing() ? "Testing…" : "Test Connection"}
        </Button>
        {testResult() && (
          <span class={`settings-status ${testResult()!.ok ? "success" : "error"}`}>
            {testResult()!.message}
          </span>
        )}
      </div>
    </div>
  );
}
