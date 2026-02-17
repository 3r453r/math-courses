"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── Types ───

interface LogEntry {
  id: string;
  generationType: string;
  schemaName: string;
  modelId: string;
  provider: string;
  userId: string | null;
  courseId: string | null;
  lessonId: string | null;
  outcome: string;
  durationMs: number;
  layer0Called: boolean;
  layer0Result: string | null;
  layer1Called: boolean;
  layer1Success: boolean;
  layer1HadWrapper: boolean;
  layer2Called: boolean;
  layer2Success: boolean;
  layer2ModelId: string | null;
  rawOutputLen: number | null;
  zodErrors: string | null;
  errorMessage: string | null;
  promptHash: string | null;
  language: string | null;
  difficulty: string | null;
  createdAt: string;
  rawOutputRedacted: boolean;
  promptRedacted: boolean;
  sensitiveTextExpiresAt: string | null;
  sensitiveTextRedactedAt: string | null;
}

interface LogDetail extends LogEntry {
  rawOutputText: string | null;
  promptText: string | null;
  layer0Error: string | null;
  rawPayloadAvailable: boolean;
}

// ─── Helpers ───

function outcomeBadgeVariant(outcome: string) {
  if (outcome === "success") return "default" as const;
  if (outcome.startsWith("repaired")) return "secondary" as const;
  return "destructive" as const;
}

function layerStatusIcon(called: boolean, success: boolean) {
  if (!called) return "—";
  return success ? "\u2713" : "\u2717";
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateError(msg: string | null, len = 50) {
  if (!msg) return "";
  return msg.length > len ? msg.slice(0, len) + "..." : msg;
}

const ANALYSIS_INSTRUCTIONS = `This is a debug report from the AI generation pipeline of an educational course platform.

## Architecture
The system uses Vercel AI SDK's \`generateObject\` to produce structured content matching Zod schemas. A 3-layer repair pipeline handles malformed AI output:

### Layer 0 — \`experimental_repairText\` (inside generateObject)
- Unwraps Anthropic \`{"parameter":{...}}\` wrapping (jsonTool mode artifact)
- Runs \`coerceToSchema\`: type coercion, enum fuzzy-match, unknown field stripping
- Attempts \`JSON.parse()\` on string values where schema expects Array/Object (handles Anthropic stringified arrays)
- Result codes: "coercion-success" (fixed it), "unwrapped-only" (only removed wrapper), "json-parse-failed", "returned-null" (gave up)

### Layer 1 — Direct coercion in catch block
- Catches \`NoObjectGeneratedError\`, extracts raw text from \`error.text\`
- Strips \`{"parameter":...}\` wrapper if present (\`hadWrapper\` flag)
- Runs \`tryCoerceAndValidate\` — same coercion logic as L0 but on the raw error text
- If Zod validation still fails, \`zodErrors\` captures the specific issues

### Layer 2 — AI repack
- Last resort: sends the raw output + schema to the cheapest available model
- Asks it to re-serialize the content to match the schema
- \`layer2ModelId\` records which model was used

## Common Failure Patterns
1. **Stringified arrays**: AI returns \`"sections":"[{...}]"\` (string) instead of \`"sections":[{...}]\` (array). The coercion layer tries \`JSON.parse()\` but embedded quotes can break it.
2. **Unescaped quotes in stringified content**: Polish quotes (\\u201E\\u201D) or exclamation marks inside stringified JSON break inner \`JSON.parse\`. The \`repairJsonString\` function handles this with a state-machine parser.
3. **Invented enum values**: AI creates enum values not in the schema (e.g., "MATH" instead of "math"). Fuzzy matching tries to fix these.
4. **Extra/unknown fields**: AI adds fields not in the schema. Coercion strips these.
5. **Missing required fields**: AI omits required fields. These usually cause Zod errors that can't be auto-repaired.
6. **Anthropic 180s timeout**: Constrained decoding mode times out for large schemas. Should use \`jsonTool\` mode.

## What to Analyze
1. Look at the **Zod errors** — which paths/fields failed validation?
2. Check the **raw output** — is it valid JSON? What does the structure look like?
3. Compare against the **schema source** — are there mismatches in field names, types, or enum values?
4. Check repair layer progression — did L0/L1 get close to fixing it? What specifically failed?
5. Look at the **prompt** (if included) — could the instructions be clearer about the expected format?`;

// ─── Component ───

export function GenerationLogManager() {
  const { t } = useTranslation(["admin"]);

  // Data
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Detail dialog
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [logDetail, setLogDetail] = useState<LogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Derived filter options from data
  const [allTypes, setAllTypes] = useState<string[]>([]);
  const [allModels, setAllModels] = useState<string[]>([]);

  // ─── Fetch logs ───

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, outcomeFilter, modelFilter, fromDate, toDate, offset]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);
      if (modelFilter !== "all") params.set("model", modelFilter);
      if (fromDate) params.set("from", new Date(fromDate).toISOString());
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        params.set("to", end.toISOString());
      }
      params.set("limit", String(limit));
      params.set("offset", String(offset));

      const res = await fetch(`/api/admin/generation-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
        setStats(data.stats || {});

        // Extract distinct types and models for filter dropdowns
        const types: string[] = [...new Set<string>(data.logs.map((l: LogEntry) => l.generationType))].sort();
        const models: string[] = [...new Set<string>(data.logs.map((l: LogEntry) => l.modelId))].sort();
        setAllTypes((prev) => {
          const merged: string[] = [...new Set<string>([...prev, ...types])].sort();
          return merged.length !== prev.length ? merged : prev;
        });
        setAllModels((prev) => {
          const merged: string[] = [...new Set<string>([...prev, ...models])].sort();
          return merged.length !== prev.length ? merged : prev;
        });
      }
    } catch (err) {
      console.error("Failed to fetch generation logs:", err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Fetch detail ───

  async function openDetail(logId: string) {
    setSelectedLogId(logId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/generation-logs/${logId}`);
      if (res.ok) {
        setLogDetail(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch log detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  // ─── Generate Report ───

  async function generateReport(log: LogDetail) {
    let schemaSource = null;
    try {
      const res = await fetch(
        `/api/admin/generation-logs/schema-source?name=${encodeURIComponent(log.schemaName)}`
      );
      if (res.ok) {
        schemaSource = await res.json();
      }
    } catch {
      // Schema source is optional
    }

    const totalCount = Object.values(stats).reduce((a, b) => a + b, 0);
    const zodErrorsParsed = log.zodErrors ? JSON.parse(log.zodErrors) : [];
    const zodCount = zodErrorsParsed.length;

    const layerSummaries: string[] = [];
    if (log.layer0Called) layerSummaries.push(`L0 (${log.layer0Result || "unknown"})`);
    if (log.layer1Called) layerSummaries.push(`L1 (${log.layer1Success ? "success" : "failed"}${log.layer1HadWrapper ? ", had wrapper" : ""})`);
    if (log.layer2Called) layerSummaries.push(`L2 (${log.layer2Success ? "success" : "failed"})`);

    const report = {
      reportVersion: "1.0",
      generatedAt: new Date().toISOString(),
      summary: `${log.outcome === "failed" ? "Failed" : log.outcome === "success" ? "Successful" : "Repaired"} ${log.generationType} generation using ${log.modelId} (${log.provider}). ${layerSummaries.length > 0 ? `Layers: ${layerSummaries.join(", ")}.` : ""} ${zodCount > 0 ? `${zodCount} Zod error(s).` : "No Zod errors."} Total logs in current filter: ${totalCount}.`,
      log: {
        id: log.id,
        generationType: log.generationType,
        schemaName: log.schemaName,
        modelId: log.modelId,
        provider: log.provider,
        outcome: log.outcome,
        durationMs: log.durationMs,
        language: log.language,
        difficulty: log.difficulty,
        createdAt: log.createdAt,
        courseId: log.courseId,
        lessonId: log.lessonId,
        repairPipeline: {
          layer0: {
            called: log.layer0Called,
            result: log.layer0Result,
            error: log.layer0Error,
          },
          layer1: {
            called: log.layer1Called,
            success: log.layer1Success,
            hadWrapper: log.layer1HadWrapper,
            zodErrors: zodErrorsParsed,
          },
          layer2: {
            called: log.layer2Called,
            success: log.layer2Success,
            modelId: log.layer2ModelId,
          },
        },
        rawOutput: {
          text: log.rawOutputText,
          length: log.rawOutputLen,
          wasTruncated: log.rawOutputText
            ? log.rawOutputText.length < (log.rawOutputLen ?? 0)
            : false,
        },
        prompt: {
          text: log.promptText,
          hash: log.promptHash,
        },
        errorMessage: log.errorMessage,
      },
      schema: schemaSource
        ? {
            name: schemaSource.name,
            filePath: schemaSource.filePath,
            source: schemaSource.source,
          }
        : null,
      analysisInstructions: ANALYSIS_INSTRUCTIONS,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gen-log-${log.id}-${log.outcome}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("admin:generationLogs.reportDownloaded"));
  }

  // ─── Copy helper ───

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(t("admin:generationLogs.copied"));
  }

  // ─── Stats ───

  const totalLogs = Object.values(stats).reduce((a, b) => a + b, 0);
  const successCount = stats["success"] || 0;
  const repairedCount =
    (stats["repaired_layer0"] || 0) +
    (stats["repaired_layer1"] || 0) +
    (stats["repaired_layer2"] || 0);
  const failedCount = stats["failed"] || 0;
  const successRate = totalLogs > 0 ? ((successCount / totalLogs) * 100).toFixed(1) : "0";

  // ─── Reset offset when filters change ───

  function handleFilterChange(setter: (v: string) => void, value: string) {
    setOffset(0);
    setter(value);
  }

  // ─── Render ───

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t("admin:generationLogs.stats.total")}
          value={String(totalLogs)}
        />
        <StatCard
          label={t("admin:generationLogs.stats.successRate")}
          value={`${successRate}%`}
          sub={`${successCount} / ${totalLogs}`}
        />
        <StatCard
          label={t("admin:generationLogs.stats.repaired")}
          value={String(repairedCount)}
          variant="amber"
        />
        <StatCard
          label={t("admin:generationLogs.stats.failed")}
          value={String(failedCount)}
          variant="red"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select
          value={typeFilter}
          onValueChange={(v) => handleFilterChange(setTypeFilter, v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("admin:generationLogs.filters.allTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("admin:generationLogs.filters.allTypes")}
            </SelectItem>
            {allTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={outcomeFilter}
          onValueChange={(v) => handleFilterChange(setOutcomeFilter, v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("admin:generationLogs.filters.allOutcomes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("admin:generationLogs.filters.allOutcomes")}
            </SelectItem>
            {["success", "repaired_layer0", "repaired_layer1", "repaired_layer2", "failed"].map(
              (outcome) => (
                <SelectItem key={outcome} value={outcome}>
                  {t(`admin:generationLogs.outcomes.${outcome}`)}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        <Select
          value={modelFilter}
          onValueChange={(v) => handleFilterChange(setModelFilter, v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("admin:generationLogs.filters.allModels")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("admin:generationLogs.filters.allModels")}
            </SelectItem>
            {allModels.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {t("admin:generationLogs.filters.from")}
          </span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => handleFilterChange(setFromDate, e.target.value)}
            className="w-36 h-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {t("admin:generationLogs.filters.to")}
          </span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => handleFilterChange(setToDate, e.target.value)}
            className="w-36 h-9"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground">{t("admin:generationLogs.noLogs")}</p>
      ) : (
        <>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">
                    {t("admin:generationLogs.columns.timestamp")}
                  </th>
                  <th className="text-left p-3 font-medium">
                    {t("admin:generationLogs.columns.type")}
                  </th>
                  <th className="text-left p-3 font-medium">
                    {t("admin:generationLogs.columns.model")}
                  </th>
                  <th className="text-left p-3 font-medium">
                    {t("admin:generationLogs.columns.outcome")}
                  </th>
                  <th className="text-left p-3 font-medium">
                    {t("admin:generationLogs.columns.duration")}
                  </th>
                  <th className="text-left p-3 font-medium">
                    {t("admin:generationLogs.columns.layers")}
                  </th>
                  <th className="text-left p-3 font-medium">
                    {t("admin:generationLogs.columns.error")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => openDetail(log.id)}
                  >
                    <td className="p-3 text-muted-foreground whitespace-nowrap tabular-nums">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">{log.generationType}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {log.modelId}
                    </td>
                    <td className="p-3">
                      <Badge variant={outcomeBadgeVariant(log.outcome)}>
                        {t(`admin:generationLogs.outcomes.${log.outcome}`, log.outcome)}
                      </Badge>
                    </td>
                    <td className="p-3 tabular-nums">
                      {formatDuration(log.durationMs)}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1.5 text-xs">
                        {log.layer0Called && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            L0
                          </Badge>
                        )}
                        {log.layer1Called && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            L1
                          </Badge>
                        )}
                        {log.layer2Called && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            L2
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {truncateError(log.errorMessage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t("admin:generationLogs.pagination.showing", {
                from: offset + 1,
                to: Math.min(offset + limit, total),
                total,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                {t("admin:generationLogs.pagination.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                {t("admin:generationLogs.pagination.next")}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detail dialog */}
      <Dialog
        open={!!selectedLogId}
        onOpenChange={() => {
          setSelectedLogId(null);
          setLogDetail(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("admin:generationLogs.detail.title")}</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : logDetail ? (
            <div className="space-y-5">
              {/* Metadata */}
              <section>
                <h3 className="text-sm font-semibold mb-2">
                  {t("admin:generationLogs.detail.metadata")}
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <MetaRow
                    label={t("admin:generationLogs.columns.type")}
                    value={logDetail.generationType}
                  />
                  <MetaRow
                    label={t("admin:generationLogs.columns.model")}
                    value={logDetail.modelId}
                  />
                  <MetaRow
                    label={t("admin:generationLogs.detail.provider")}
                    value={logDetail.provider}
                  />
                  <MetaRow
                    label={t("admin:generationLogs.detail.schema")}
                    value={logDetail.schemaName}
                  />
                  <MetaRow
                    label={t("admin:generationLogs.columns.outcome")}
                  >
                    <Badge variant={outcomeBadgeVariant(logDetail.outcome)}>
                      {t(`admin:generationLogs.outcomes.${logDetail.outcome}`, logDetail.outcome)}
                    </Badge>
                  </MetaRow>
                  <MetaRow
                    label={t("admin:generationLogs.detail.duration")}
                    value={formatDuration(logDetail.durationMs)}
                  />
                  <MetaRow
                    label={t("admin:generationLogs.detail.language")}
                    value={logDetail.language || "—"}
                  />
                  <MetaRow
                    label={t("admin:generationLogs.detail.difficulty")}
                    value={logDetail.difficulty || "—"}
                  />
                  <MetaRow
                    label={t("admin:generationLogs.detail.retention")}
                    value={logDetail.sensitiveTextExpiresAt ? new Date(logDetail.sensitiveTextExpiresAt).toLocaleString() : "—"}
                  />
                  <MetaRow
                    label={t("admin:generationLogs.detail.redactedAt")}
                    value={logDetail.sensitiveTextRedactedAt ? new Date(logDetail.sensitiveTextRedactedAt).toLocaleString() : "—"}
                  />
                  <MetaRow
                    label={t("admin:generationLogs.detail.courseId")}
                    value={logDetail.courseId || "—"}
                  />
                  <MetaRow
                    label={t("admin:generationLogs.detail.lessonId")}
                    value={logDetail.lessonId || "—"}
                  />
                </div>
              </section>

              {/* Repair pipeline */}
              <section>
                <h3 className="text-sm font-semibold mb-2">
                  {t("admin:generationLogs.detail.repairPipeline")}
                </h3>
                <div className="flex gap-2 items-stretch">
                  <PipelineCard
                    title={t("admin:generationLogs.detail.layer0")}
                    called={logDetail.layer0Called}
                    success={logDetail.layer0Result === "coercion-success"}
                    notCalledLabel={t("admin:generationLogs.detail.notCalled")}
                  >
                    {logDetail.layer0Called && (
                      <div className="text-xs space-y-0.5">
                        <div>
                          <span className="text-muted-foreground">
                            {t("admin:generationLogs.detail.result")}:{" "}
                          </span>
                          {logDetail.layer0Result || "—"}
                        </div>
                        {logDetail.layer0Error && (
                          <div className="text-destructive truncate" title={logDetail.layer0Error}>
                            {logDetail.layer0Error}
                          </div>
                        )}
                      </div>
                    )}
                  </PipelineCard>

                  <div className="flex items-center text-muted-foreground">&rarr;</div>

                  <PipelineCard
                    title={t("admin:generationLogs.detail.layer1")}
                    called={logDetail.layer1Called}
                    success={logDetail.layer1Success}
                    notCalledLabel={t("admin:generationLogs.detail.notCalled")}
                  >
                    {logDetail.layer1Called && (
                      <div className="text-xs space-y-0.5">
                        <div>
                          {layerStatusIcon(logDetail.layer1Called, logDetail.layer1Success)}{" "}
                          {logDetail.layer1Success ? "Success" : "Failed"}
                        </div>
                        {logDetail.layer1HadWrapper && (
                          <div>
                            <span className="text-muted-foreground">
                              {t("admin:generationLogs.detail.hadWrapper")}:{" "}
                            </span>
                            Yes
                          </div>
                        )}
                      </div>
                    )}
                  </PipelineCard>

                  <div className="flex items-center text-muted-foreground">&rarr;</div>

                  <PipelineCard
                    title={t("admin:generationLogs.detail.layer2")}
                    called={logDetail.layer2Called}
                    success={logDetail.layer2Success}
                    notCalledLabel={t("admin:generationLogs.detail.notCalled")}
                  >
                    {logDetail.layer2Called && (
                      <div className="text-xs space-y-0.5">
                        <div>
                          {layerStatusIcon(logDetail.layer2Called, logDetail.layer2Success)}{" "}
                          {logDetail.layer2Success ? "Success" : "Failed"}
                        </div>
                        {logDetail.layer2ModelId && (
                          <div>
                            <span className="text-muted-foreground">
                              {t("admin:generationLogs.detail.repackModel")}:{" "}
                            </span>
                            {logDetail.layer2ModelId}
                          </div>
                        )}
                      </div>
                    )}
                  </PipelineCard>
                </div>
              </section>

              {/* Zod Errors */}
              <section>
                <h3 className="text-sm font-semibold mb-2">
                  {t("admin:generationLogs.detail.zodErrors")}
                </h3>
                <ZodErrorTable
                  zodErrors={logDetail.zodErrors}
                  t={t}
                />
              </section>

              {/* Raw Output */}
              <CollapsibleSection
                title={t("admin:generationLogs.detail.rawOutput")}
                subtitle={
                  logDetail.rawOutputLen
                    ? t("admin:generationLogs.detail.characters", {
                        count: logDetail.rawOutputLen,
                      })
                    : undefined
                }
              >
                {logDetail.rawOutputText ? (
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 text-xs"
                      onClick={() => copyToClipboard(logDetail.rawOutputText!)}
                    >
                      {t("admin:generationLogs.copy")}
                    </Button>
                    <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
                      {logDetail.rawOutputText}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {logDetail.rawPayloadAvailable
                      ? t("admin:generationLogs.detail.notAvailable")
                      : t("admin:generationLogs.detail.restricted")}
                  </p>
                )}
              </CollapsibleSection>

              {/* Prompt */}
              {logDetail.outcome !== "success" && (
                <CollapsibleSection
                  title={t("admin:generationLogs.detail.prompt")}
                  subtitle={logDetail.promptHash ? `#${logDetail.promptHash.slice(0, 8)}` : undefined}
                >
                  {logDetail.promptText ? (
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 text-xs"
                        onClick={() => copyToClipboard(logDetail.promptText!)}
                      >
                        {t("admin:generationLogs.copy")}
                      </Button>
                      <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto max-h-80 whitespace-pre-wrap break-all">
                        {logDetail.promptText}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {logDetail.rawPayloadAvailable
                      ? t("admin:generationLogs.detail.notAvailable")
                      : t("admin:generationLogs.detail.restricted")}
                    </p>
                  )}
                </CollapsibleSection>
              )}

              {/* Error message */}
              {logDetail.errorMessage && (
                <section>
                  <h3 className="text-sm font-semibold mb-1 text-destructive">
                    {t("admin:generationLogs.columns.error")}
                  </h3>
                  <pre className="text-xs bg-destructive/10 text-destructive p-3 rounded whitespace-pre-wrap break-all">
                    {logDetail.errorMessage}
                  </pre>
                </section>
              )}

              {/* Generate Report */}
              <div className="pt-2 border-t">
                <Button onClick={() => generateReport(logDetail)}>
                  {t("admin:generationLogs.generateReport")}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───

function StatCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "amber" | "red";
}) {
  const colorClass =
    variant === "red"
      ? "text-destructive"
      : variant === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "";

  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MetaRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[80px]">{label}:</span>
      {children || <span className="font-mono text-xs">{value}</span>}
    </div>
  );
}

function PipelineCard({
  title,
  called,
  success,
  notCalledLabel,
  children,
}: {
  title: string;
  called: boolean;
  success: boolean;
  notCalledLabel: string;
  children?: React.ReactNode;
}) {
  const borderColor = !called
    ? "border-muted"
    : success
      ? "border-green-500/50"
      : "border-destructive/50";
  const bgColor = !called
    ? "bg-muted/20"
    : success
      ? "bg-green-500/5"
      : "bg-destructive/5";

  return (
    <div className={`flex-1 border rounded-lg p-3 ${borderColor} ${bgColor}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs font-medium">{title}</span>
        {called && (
          <span className={success ? "text-green-600" : "text-destructive"}>
            {success ? "\u2713" : "\u2717"}
          </span>
        )}
      </div>
      {!called ? (
        <p className="text-xs text-muted-foreground">{notCalledLabel}</p>
      ) : (
        children
      )}
    </div>
  );
}

function ZodErrorTable({
  zodErrors,
  t,
}: {
  zodErrors: string | null;
  t: (key: string) => string;
}) {
  if (!zodErrors) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("admin:generationLogs.detail.noErrors")}
      </p>
    );
  }

  let errors: Array<{ path?: string[]; code?: string; message?: string }>;
  try {
    errors = JSON.parse(zodErrors);
  } catch {
    return <pre className="text-xs bg-muted/50 p-2 rounded">{zodErrors}</pre>;
  }

  if (errors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("admin:generationLogs.detail.noErrors")}
      </p>
    );
  }

  return (
    <div className="border rounded overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2 font-medium">
              {t("admin:generationLogs.detail.path")}
            </th>
            <th className="text-left p-2 font-medium">
              {t("admin:generationLogs.detail.code")}
            </th>
            <th className="text-left p-2 font-medium">
              {t("admin:generationLogs.detail.message")}
            </th>
          </tr>
        </thead>
        <tbody>
          {errors.map((err, i) => (
            <tr key={i} className="border-t">
              <td className="p-2 font-mono">{(err.path || []).join(".")}</td>
              <td className="p-2">{err.code}</td>
              <td className="p-2 text-muted-foreground">{err.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 text-sm font-semibold hover:text-foreground w-full text-left">
          <span className="text-xs">{open ? "\u25BC" : "\u25B6"}</span>
          {title}
          {subtitle && (
            <span className="text-xs font-normal text-muted-foreground">
              ({subtitle})
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
