"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AgentGuardNav } from "../agent-guard-nav";

interface FAQ {
  q: string;
  a: string;
  category: string;
}

const faqs: FAQ[] = [
  {
    category: "Getting Started",
    q: "What is AgentGuard today?",
    a: "AgentGuard is a pilot activity evaluation layer. It accepts AI activity submitted to the ingest API, classifies the submitted content in memory, stores classification metadata and content length, and evaluates enabled policies for allow or block decisions.",
  },
  {
    category: "Getting Started",
    q: "How is AgentGuard different from ShadowGuard?",
    a: "ShadowGuard discovers AI-related tools and OAuth grants. AgentGuard evaluates activity that your app, wrapper, or internal integration submits to it. ShadowGuard discovery does not automatically make AgentGuard monitor every discovered tool today.",
  },
  {
    category: "Getting Started",
    q: "Do I need ShadowGuard to use AgentGuard?",
    a: "They work best together, but the current AgentGuard pilot can evaluate submitted activity on its own when your organization has AgentGuard or Guard Complete access. ShadowGuard remains the discovery and governance system of record.",
  },
  {
    category: "Getting Started",
    q: "What is not shipped yet?",
    a: "AgentGuard does not yet include a packaged browser extension, universal collector, published or installable SDK packages, hosted receiver deployment, vendor-specific SIEM connector packs, background retry queues, employee appeal workflow, automatic third-party quarantine hold, or automatic activity capture from every AI tool. It does include copyable SDK starter examples for customer-controlled server-side integrations. Automatic export is a guarded HTTPS preview, not universal notification coverage.",
  },
  {
    category: "Getting Started",
    q: "Is there an operator guide for the whole AgentGuard process?",
    a: "Yes. The AgentGuard Guide is a read-only workflow support page that turns the growing AgentGuard surface area into a practical operating path: orient on current posture, connect a source, tune policy coverage, prove readiness evidence, and plan customer-owned integration paths. Use this guide as the map and the Setup page as the live next-action board. The guide links to existing pages and does not create source keys, send test events, change policies, mutate reviews, change export settings, save evidence packets, create acknowledgements, or expand enforcement.",
  },
  {
    category: "Getting Started",
    q: "Is there a checklist for enterprise demos or release smoke tests?",
    a: "Yes. The AgentGuard Guide includes an operator-run enterprise smoke-test checklist for demo and release readiness across login/MFA, ShadowGuard discovery, AI Governance assessment/report/export, AgentGuard source-key test events, monitoring, policies, reviews, readiness evidence, runbook/checklist handoff, and export dry-run/live posture. It shows what to run, expected results, failure signals, fix routes, and guardrails. The checklist does not automate tests, create data, mutate settings, prove compliance, certify security, provide legal advice, expand monitoring, create managed connectors, or enforce policy by itself.",
  },
  {
    category: "Getting Started",
    q: "Is there an enterprise pilot package?",
    a: "Yes. The AgentGuard Guide includes an Enterprise pilot package with 7-day and 14-day pilot options, phase-by-phase operator and customer responsibilities, proof artifacts, entry criteria, exit criteria, and the production activity endpoint. It is deployment guidance and readiness support for customer-controlled server-side wrappers; it is not legal advice, not a certification, not a compliance determination, not an auditor attestation, not a security warranty, not automatic monitoring, not a hosted collector, not a managed connector, and not enforcement by itself.",
  },
  {
    category: "Getting Started",
    q: "Does AgentGuard explain what to do on each workflow page?",
    a: "Yes. Setup, Ingestion, and Policies include Workflow assist panels with page-specific confirm items, evidence to see, next links, and boundary copy. Workflow assist is read-only navigation support; it does not create source keys, send test events, change policies, mutate reviews, change export settings, save evidence packets, create acknowledgements, or expand enforcement.",
  },
  {
    category: "Monitoring",
    q: "How does activity get into AgentGuard?",
    a: "Today, activity is submitted through POST /api/agent-guard/activity, either from a signed-in dashboard session or from a server-side integration using a scoped source key. Customer-controlled server-side wrappers call that path on their own ShadowGuard origin with Authorization: Bearer <source-key>. Safe demo data can also be loaded from the dashboard.",
  },
  {
    category: "Monitoring",
    q: "What production endpoint should a customer wrapper call?",
    a: "Use POST $SHADOWGUARD_APP_URL/api/agent-guard/activity with content-type: application/json and Authorization: Bearer <source-key>. The source key must stay in a server-side secret such as AGENTGUARD_INGEST_TOKEN. This endpoint is for trusted server-side wrappers only; it is not a browser collector, universal monitor, managed connector, secret vault, raw-content archive, or compliance determination.",
  },
  {
    category: "Monitoring",
    q: "Is there an enterprise integration contract for customer engineers?",
    a: "Yes. The AgentGuard Guide includes a versioned integration contract for customer-controlled server-side wrappers calling /api/agent-guard/activity on this installation. It documents headers, request fields, response fields, supported activity types, risk levels, error codes, safe sample payloads, cURL, Node fetch, Next.js Route Handler, and Python requests examples, plus a downloadable markdown contract. It is reference material only: not a managed connector, browser collector, hosted collector, universal monitor, published SDK package, legal advice, certification, compliance determination, auditor attestation, security warranty, or automatic enforcement.",
  },
  {
    category: "Monitoring",
    q: "Can AgentGuard help troubleshoot a customer wrapper?",
    a: "Yes. The Ingestion page includes diagnostics for customer-controlled server-side wrappers calling /api/agent-guard/activity on this installation. It explains invalid_json, validation_failed, invalid_ingest_token, tool_not_allowed_for_source, and rate_limited responses with next checks and copyable PowerShell, cURL, Node fetch, and Python requests commands. Diagnostics are reference material only: not a managed connector, automatic monitoring, enforcement, source-key recovery, secret storage, raw-content storage, legal advice, certification, compliance determination, auditor attestation, or security warranty.",
  },
  {
    category: "Monitoring",
    q: "Do you provide starter code for engineering teams?",
    a: "Yes. The Ingestion page includes an SDK Starter Kit with copyable TypeScript helper, Python requests, cURL smoke test, and generic AI proxy/wrapper examples for POST /api/agent-guard/activity. These are customer-controlled server-side starter patterns, not published SDK packages, browser collectors, hosted collectors, managed connectors, or automatic monitoring. Source keys must stay in server-side secrets.",
  },
  {
    category: "Monitoring",
    q: "Can I document how an AgentGuard source was implemented?",
    a: "Yes. The Ingestion page includes Integration Evidence for metadata-only implementation records: owner or team, wrapper location, evidence link, checklist state, status, and short notes. It is not secret storage, not raw content storage, not legal advice, not a certification, not a compliance determination, not an auditor attestation, and not automatic monitoring. Do not paste source keys, private keys, raw prompts, responses, files, or message content into evidence fields.",
  },
  {
    category: "Monitoring",
    q: "What are AgentGuard source keys?",
    a: "Source keys are revocable bearer credentials for trusted server-side systems that submit activity to AgentGuard. The key is shown once, stored only as a hash, and can be scoped to specific tool names. The Ingestion page shows source health, last-used metadata, and recent source-attributed activity.",
  },
  {
    category: "Monitoring",
    q: "Is there a source-key lifecycle handoff?",
    a: "Yes. The Ingestion page includes a source-key lifecycle handoff for customer-controlled server-side wrappers. It summarizes source next actions, token hints only, allowed tool scope, last-used metadata, advisory rotation posture, lifecycle stages, and a copyable handoff for create, store, test, confirm, replacement-first rotation, revoke, and metadata-only documentation steps. It does not create source keys, reveal source keys, recover source keys, rotate keys automatically, expire keys automatically, store secrets, store raw content, deliver managed connectors, perform automatic monitoring, or enforce policy by itself.",
  },
  {
    category: "Monitoring",
    q: "Can I see which source submitted activity?",
    a: "Yes. Activity submitted with a source key includes source attribution metadata. The Ingestion page groups recent submitted activity under the matching source, and the activity feed shows source attribution when it is present.",
  },
  {
    category: "Monitoring",
    q: "Can I see whether a source has policy coverage?",
    a: "Yes. The Ingestion page includes deterministic source-to-policy coverage guidance from recent submitted activity, block outcomes, and policy review rows. It shows which sources are quiet, sending activity without recent policy outcomes, producing policy outcomes, or clearly test/non-production sources. It does not automatically monitor tools, change policies, or generate AI recommendations.",
  },
  {
    category: "Monitoring",
    q: "How do I know when AgentGuard is ready for production rollout?",
    a: "The Ingestion page includes advisory production rollout guardrails. It checks active source setup, recent submitted activity, source tool scope, policy coverage, review queue capacity, and export posture, then labels the rollout as Testing, Ready for pilot, Needs review, or Live caution. The guardrails do not promote sources, change policies, switch export modes, or expand enforcement automatically.",
  },
  {
    category: "Monitoring",
    q: "Can I record who reviewed a rollout decision?",
    a: "Yes. The Ingestion page includes rollout acknowledgements that record who reviewed a source posture, the source rollout status, overall rollout status, checklist snapshot, export posture, timestamp, and optional operator note. They are advisory historical evidence and acknowledgement history only; they do not promote sources, change policies, switch export modes, or expand enforcement.",
  },
  {
    category: "Monitoring",
    q: "Can I get one AgentGuard readiness summary?",
    a: "Yes. The Readiness page builds a read-only pilot readiness report from existing AgentGuard metadata: source setup, recent submitted activity, policy coverage, review queue posture, export posture, and rollout acknowledgement evidence. It includes a copyable evidence packet for operator, board, client, or auditor conversations, but it is not legal advice, not a certification, and not a compliance determination.",
  },
  {
    category: "Monitoring",
    q: "Can AgentGuard tell me what to do next?",
    a: "Yes. The AgentGuard overview includes a read-only operator command center that turns existing source posture, submitted activity, policy coverage, review load, export posture, rollout acknowledgement metadata, and pilot readiness into deterministic next-action guidance. It links to existing AgentGuard pages and does not create source keys, change policies, mutate reviews, change export settings, create acknowledgements, or expand enforcement.",
  },
  {
    category: "Monitoring",
    q: "Can I save AgentGuard evidence for enterprise-readiness review?",
    a: "Yes. The Readiness page can save metadata-only AgentGuard evidence packets that preserve the current readiness report and operator command center as point-in-time evidence. Saved packets are read-only operational evidence for enterprise-readiness, client, board, auditor, or internal review conversations; they are not legal advice, not a certification, not a compliance determination, and not an auditor attestation. Saving a packet does not change source keys, policies, reviews, export settings, acknowledgements, or enforcement.",
  },
  {
    category: "Monitoring",
    q: "Is there a guided enterprise setup path?",
    a: "Yes. The AgentGuard Setup page shows read-only enterprise-readiness setup guidance across source setup, submitted activity, policy baseline, source-to-policy coverage, review queue, readiness packet, saved evidence packet history, and export receiver posture. It links to existing AgentGuard pages and does not create source keys, send test events, change policies, mutate reviews, change export settings, save packets, create acknowledgements, or expand enforcement.",
  },
  {
    category: "Monitoring",
    q: "Can I copy an enterprise runbook for AgentGuard?",
    a: "Yes. The AgentGuard Setup page includes a copyable Enterprise runbook that combines setup progress, current next step, integration evidence posture, SDK starter coverage, saved evidence packet posture, export receiver posture, and explicit boundaries. It is metadata-only operational support, not legal advice, not a certification, not a compliance determination, not an auditor attestation, not automatic monitoring, and not enforcement. Copying it does not create sources, change policies, mutate reviews, change export settings, save packets, create acknowledgements, or expand enforcement.",
  },
  {
    category: "Monitoring",
    q: "Is there one place to see the AgentGuard evidence handoff package?",
    a: "Yes. The AgentGuard Setup page includes an Enterprise handoff package that groups readiness posture, saved evidence packet status, source implementation evidence, enterprise runbook, implementation checklist, export receiver posture, and enterprise smoke-test checklist. It shows ready, available, caution, and gap states plus fix links and a copyable summary. The package is operational evidence handoff support only: not legal advice, not a certification, not a compliance determination, not an auditor attestation, not a security warranty, not automatic monitoring, not a managed connector, and not enforcement.",
  },
  {
    category: "Monitoring",
    q: "Can I give a customer engineer an AgentGuard implementation checklist?",
    a: "Yes. The AgentGuard Setup page includes a downloadable customer-engineer implementation checklist for server-side source implementation handoffs. It covers source-key handling, safe test events, policy outcome confirmation, metadata-only integration evidence, optional receiver planning, and source-key rotation. The checklist contains no source keys, signing secrets, private keys, raw prompts, responses, files, messages, or customer data. It is implementation support only: not legal advice, not a certification, not a compliance determination, not an auditor attestation, not a managed connector, not automatic monitoring, and not enforcement.",
  },
  {
    category: "Monitoring",
    q: "What activities can AgentGuard classify?",
    a: "The current API supports prompt_sent, response_received, file_upload, file_download, api_call, data_export, agent_action, and tool_invocation activity types. The result is only as complete as the activity your integration submits.",
  },
  {
    category: "Monitoring",
    q: "What AI tools does AgentGuard cover?",
    a: "AgentGuard can evaluate submitted activity for any named tool. It does not automatically collect activity from every AI product. Tool coverage depends on the source that sends activity to the ingest API.",
  },
  {
    category: "Monitoring",
    q: "Does AgentGuard store what employees type into AI tools?",
    a: "No. When content is submitted for classification, AgentGuard processes it in memory and stores metadata such as tool name, user email, activity type, sensitivity, categories, risk level, policy decision, and content length. Raw prompt, response, file, or message text is not persisted.",
  },
  {
    category: "Monitoring",
    q: "What are data flows in the dashboard?",
    a: "The monitoring page shows rollups from submitted activity and any existing monitored tool rows. Data-flow labels summarize inbound and outbound categories, not full content transcripts.",
  },
  {
    category: "Policies",
    q: "How do policies work?",
    a: "Policies are rules evaluated against submitted activity. Conditions can match tool name, activity type, sensitivity, risk level, user email, or data category. A matching block policy returns a blocked decision to the caller.",
  },
  {
    category: "Policies",
    q: "What is the difference between block, warn, quarantine, and allow?",
    a: "Block currently affects the decision returned by the API. Warn and quarantine create dashboard review items for operators to triage, assign, resolve, or dismiss. Allow is represented in the policy model but does not create a review item. Quarantine is a review workflow label today; it does not automatically hold files or change third-party tools unless your integration acts on a returned decision.",
  },
  {
    category: "Policies",
    q: "Where do warn and quarantine decisions go?",
    a: "They appear in AgentGuard Reviews after submitted activity matches an enabled warn or quarantine policy. Review rows include policy, action, tool, user, activity type, risk, sensitivity, metadata categories, owner, note, and status. Raw prompt, response, file, or message content is not stored in the review row.",
  },
  {
    category: "Policies",
    q: "Can employees override a blocked action?",
    a: "AgentGuard returns a block decision to the calling integration. Whether an employee can continue depends on whether that integration honors the decision. The dashboard does not provide an employee override flow today.",
  },
  {
    category: "Policies",
    q: "Can I start from policy templates?",
    a: "Yes. The Policies page includes guided starter templates for credential exposure, regulated-data review, file-upload review, critical-risk blocking, approved public-data use, and prompt activity review. Using a template only prefills an editable draft; it does not save or enable a policy until an operator reviews and saves it.",
  },
  {
    category: "Policies",
    q: "Can I see which policies are firing?",
    a: "Yes. The Policies page includes deterministic policy outcome analytics from recent submitted activity and policy review rows. It counts block outcomes, warn/quarantine review outcomes, needs-action review load, affected tools/users, and rule-based tuning signals. It does not automatically change policies or generate AI recommendations.",
  },
  {
    category: "Policies",
    q: "What default policies are included?",
    a: "Default policies include blocking credential exfiltration, warning on selected PII exposure, blocking critical-risk activity, quarantining file uploads, allowing public data to approved tools, and a disabled bulk-usage alert policy for future tuning. Guided templates mirror these starting points and explain whether a draft blocks, warns, creates a quarantine review item, or documents allowed use.",
  },
  {
    category: "Privacy & Security",
    q: "Does AgentGuard read employee messages?",
    a: "AgentGuard receives content only when a customer-controlled source submits it for classification. The classifier checks patterns and markers in memory, then stores classification metadata and content length instead of the raw text.",
  },
  {
    category: "Privacy & Security",
    q: "Can employees see what AgentGuard detects about them?",
    a: "There is no employee-facing activity portal today. Organizations should set their own employee notice, monitoring, and review process before submitting employee activity to AgentGuard.",
  },
  {
    category: "Privacy & Security",
    q: "Where is AgentGuard data stored?",
    a: "AgentGuard activity metadata is stored in the application database under your organization scope. Raw submitted content is processed in memory and discarded after classification.",
  },
  {
    category: "Privacy & Security",
    q: "What abuse protections are built in?",
    a: "ShadowGuard uses org-scoped RLS, role-aware RLS mutation policies, MFA-gated admin and manager mutations, a same-origin API mutation guard for browser requests, hashed AgentGuard source keys, invalid source-key attempt rate limiting, encrypted export signing secrets, signed metadata-only export events, and audit events for key admin actions. These controls support abuse-resistance and enterprise-readiness review, but they do not make ShadowGuard hack-proof and are not a substitute for a customer security program, WAF strategy, endpoint security, or incident response process.",
  },
  {
    category: "Privacy & Security",
    q: "Is there a production operations runbook?",
    a: "Yes. The production operations runbook covers canonical endpoints, production environment variables, initial-schema checks, rollback and recovery steps, backup/restore notes, and incident-response handoff guidance. It is operations support only: not legal advice, not a certification, not a compliance determination, not an auditor attestation, not a security warranty, not automatic monitoring, not managed connector delivery, and not incident-response automation.",
  },
  {
    category: "Privacy & Security",
    q: "Do AgentGuard source keys rotate automatically?",
    a: "No. Source keys are revocable bearer credentials, and automatic expiry is not enabled because it could break customer-controlled server-side wrappers without a coordinated rotation. The Ingestion page now shows source-key rotation posture against an advisory rotation window so operators can create a replacement key, send a test event, update the server-side secret, and revoke the old key.",
  },
  {
    category: "Features",
    q: "What alerts does AgentGuard send?",
    a: "The current ingest route can create an internal dashboard alert when submitted activity is blocked by policy and can create review queue items when warn or quarantine policies match. Generic alert routing reuses AgentGuard export destinations for selected metadata-only events: agentguard.activity.evaluated, agentguard.policy.blocked, and agentguard.review.required. Export destinations can log dry-run attempts or send signed HTTPS events only when the destination is enabled, automatic delivery is on, the event type is selected, and dry-run is off. Customer-owned HTTPS receivers and middleware own downstream notification, Slack, Teams, email, SIEM, SOAR, ticketing, field mapping, escalation, and storage behavior. Native Slack apps, Teams apps, email services, managed SIEM connectors, SOAR/ticketing automation, and background retry queues are not shipped yet.",
  },
  {
    category: "Features",
    q: "Does the readiness report change anything?",
    a: "No. The AgentGuard pilot readiness report is read-only and metadata-only. It does not change source keys, policies, reviews, export destinations, acknowledgement history, or enforcement behavior. It summarizes what is visible in the loaded AgentGuard metadata window and keeps Needs review or Live caution posture visible.",
  },
  {
    category: "Features",
    q: "Can AgentGuard help me troubleshoot a quiet source?",
    a: "Yes. The Ingestion page shows whether a source is never used, working, revoked, or test-failed, plus recent submitted activity when available. Quiet-source guidance helps check the server-side source key, bearer authorization header, allowed tool scope, and dashboard test-event path.",
  },
  {
    category: "Features",
    q: "Can AgentGuard integrate with our SIEM?",
    a: "Partially, through a guarded HTTPS destination path and customer-owned middleware. AgentGuard can store an opt-in webhook/SIEM endpoint, generate a one-time signing secret, send a metadata-only signed test event, preview automatic delivery for selected event types, show destination health, manually replay failed attempts, and provide receiver-side verification examples. Live outbound delivery only runs when the destination is enabled, automatic delivery is on, the event type matches, and dry-run is off. Native managed SIEM connectors and SIEM-specific transformations are not shipped today.",
  },
  {
    category: "Features",
    q: "What is the connector readiness matrix?",
    a: "AgentGuard Settings includes a Connector readiness matrix for customer-owned HTTPS receiver paths across webhook, SIEM intake, SOAR/ticketing middleware, chat/email relay, data lake/event bus receiver, and audit/evidence repository workflows. It is readiness planning only: ShadowGuard supports guarded HTTPS export destinations and receiver examples, but it does not ship native managed SIEM, SOAR, ticketing, Slack, Teams, email, data lake, or audit-vault connectors, and it does not automatically create tickets or send chat/email notifications.",
  },
  {
    category: "Features",
    q: "Can customer engineers map AgentGuard export fields into our receiver?",
    a: "Yes. AgentGuard Settings includes Receiver field-mapping templates with a field dictionary and copyable generic mappings for webhook/event log, SIEM HTTP intake, and customer alert queue receiver records. The templates cover agentguard.activity.evaluated, agentguard.policy.blocked, and agentguard.review.required metadata-only export events. They are customer-owned transformation guidance only: not vendor-specific API clients, not managed SIEM connectors, not native Slack/Teams/email/ticketing/SOAR integrations, not automatic retry, not automatic escalation, not hosted receiver operations, and not raw content export.",
  },
  {
    category: "Features",
    q: "What is native connector groundwork?",
    a: "Native connector groundwork is the preflight decision framework in AgentGuard Settings. It defines the first future native connector candidate as a Slack workflow URL or incoming webhook preview, while keeping the shipped path as generic HTTPS export to customer-owned receivers. The groundwork captures credential owner, credential storage boundary, manual test event path, failure behavior, rate-limit posture, data fields sent, customer responsibilities, forbidden claims, and next spec questions. It does not ship a Slack app, Teams app, email service, managed SIEM connector, SOAR connector, ticketing connector, managed customer credential storage, automatic retry, automatic escalation, hosted receiver operations, or vendor delivery.",
  },
  {
    category: "Features",
    q: "Does AgentGuard now send Slack notifications?",
    a: "The Slack workflow URL preview implementation can store customer-owned Slack workflow or incoming webhook URLs encrypted, show URL hints only with no plaintext reveal, create disabled/dry-run targets, send guarded manual metadata-only tests, record delivery attempts, show dry-run/live posture, and keep live sends behind enabled target, customer approval, successful manual test, selected event type, dry-run-off, and explicit live posture gates. It still does not install a Slack app, use Slack OAuth, use bot tokens, discover channels, provide interactive Slack workflows, retry in the background, escalate automatically, guarantee Slack delivery, or replace SIEM, ticketing, incident response, or compliance evidence.",
  },
  {
    category: "Features",
    q: "Can AgentGuard save Slack preview evidence handoffs?",
    a: "Yes. AgentGuard Settings can save metadata-only Slack preview evidence handoffs for configured Slack workflow URL or incoming webhook preview targets. Saved Slack evidence packets preserve target name, type, URL hint only, owner, approval posture, event scope, dry-run/live posture, manual success, dry-run evidence, and safe delivery-attempt summaries. They do not store plaintext Slack URLs, encrypted URL material, URL hashes, payload bodies, source keys, signing secrets, bearer tokens, raw prompts, raw responses, files, or messages. Saving Slack evidence does not send Slack messages, change target settings, enable live sends, retry in the background, escalate automatically, guarantee delivery, install a Slack app, use Slack OAuth, discover channels, provide legal advice, certify compliance, determine compliance, attest audit status, or warrant security.",
  },
  {
    category: "Features",
    q: "How do I know if Slack automatic preview is ready?",
    a: "AgentGuard Settings now shows Slack automatic preview readiness for each Slack preview target. It distinguishes auto-off, dry-run rehearsal, and outbound-caution posture from the existing target metadata, event scope, manual success, customer approval, dry-run posture, and automatic attempt evidence. This is operator guidance only: it does not send Slack messages, change target settings, enable live sends, retry in the background, escalate automatically, guarantee delivery, install a Slack app, use Slack OAuth, discover channels, provide interactive workflows, replace SIEM or ticketing, provide legal advice, certify compliance, determine compliance, attest audit status, or warrant security.",
  },
  {
    category: "Features",
    q: "Has the Slack preview path been production-validated?",
    a: "Yes, the current production validation record covers the Slack preview manual send, delivery-attempt recording, automatic preview readiness display, and copyable auto-gates handoff. That validation covers the metadata-only preview workflow and UI evidence path; it does not prove Slack app installation, OAuth, bot-token delivery, channel discovery, interactive workflows, background retry, automatic escalation, guaranteed delivery, legal advice, certification, compliance determination, auditor attestation, or security warranty.",
  },
  {
    category: "Features",
    q: "What does the Export Foundation include?",
    a: "The Export Foundation includes the metadata-only export payload contract, HMAC-SHA256 signing model, signing header names, delivery guardrails, copyable sample payload, and receiver integration examples for customer-controlled endpoints. Export Destinations add encrypted signing-secret storage, manual signed test delivery, event-type selection, dry-run logging, destination health, manual replay for failed attempts, and a gated automatic delivery preview that defaults off with dry-run on.",
  },
  {
    category: "Features",
    q: "Do you provide webhook receiver examples?",
    a: "Yes. AgentGuard Settings includes a Receiver Integration Kit with copyable Next.js Route Handler, Express, and Python FastAPI examples. The examples verify ShadowGuard signing headers, check timestamp tolerance, handle duplicate event IDs, and store metadata-only payload fields. They are customer-side receiver patterns, not hosted or managed connectors.",
  },
  {
    category: "Features",
    q: "Can I validate a customer-owned receiver before going live?",
    a: "Yes. AgentGuard Settings includes customer-owned receiver validation and HTTPS export hardening for configured HTTPS export destinations. It summarizes event-type scope, dry-run/live posture, destination health, grouped delivery failure posture, receiver ownership, escalation path, customer-confirmed acknowledgement evidence, latest delivery attempt status, 2xx receiver evidence, and a copyable handoff for customer engineers. A successful delivery shows receiver reachability and acceptance, but it does not prove receiver-side signature verification unless the customer confirms that implementation. Receiver validation and hardening does not enable live sends automatically, does not provide automatic retry or automatic escalation, and is not a hosted receiver, managed connector delivery, native SIEM connector, Slack, Teams, email, ticketing, SOAR, data lake, or audit-vault connector.",
  },
  {
    category: "Features",
    q: "Can I send a test event to a webhook?",
    a: "Yes. An admin or manager can create a disabled HTTPS destination in Settings and send a manual signed metadata-only test event. The attempt is logged with status, HTTP response, duration, and any error message.",
  },
  {
    category: "Features",
    q: "What is the ShadowGuard sync story today?",
    a: "ShadowGuard discovery and AgentGuard activity evaluation share the same product family and dashboard, but automatic activity monitoring from newly discovered ShadowGuard tools is not shipped today.",
  },
  {
    category: "Getting Started",
    q: "Does AgentGuard require separate product access?",
    a: "No. Every authenticated organization in this open-source distribution can use AgentGuard. Access still depends on organization membership, role, MFA, source-key scope, and other security controls.",
  },
  {
    category: "Technical",
    q: "How does AgentGuard integrate with Google Workspace?",
    a: "Google Workspace discovery belongs to ShadowGuard. AgentGuard does not currently receive Google Workspace real-time activity logs automatically. AgentGuard evaluates activity submitted to its ingest API.",
  },
  {
    category: "Technical",
    q: "How does AgentGuard integrate with Microsoft 365?",
    a: "Microsoft 365 discovery belongs to ShadowGuard. AgentGuard does not currently monitor Microsoft Graph activity automatically. AgentGuard evaluates submitted activity events.",
  },
  {
    category: "Technical",
    q: "Can AgentGuard work without connecting Google or Microsoft?",
    a: "Yes, for submitted activity evaluation. A Google or Microsoft connection is not required to post events to AgentGuard, but you still need a customer-controlled source to submit the activity.",
  },
];

export default function AgentGuardFAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [filter, setFilter] = useState("All");

  const categories = ["All", ...Array.from(new Set(faqs.map((f) => f.category)))];
  const filtered = filter === "All" ? faqs : faqs.filter((f) => f.category === filter);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">AgentGuard FAQ</h2>
        <p className="text-sm text-slate-500">
          Current pilot behavior, setup boundaries, privacy posture, and roadmap-aware answers.
        </p>
      </div>

      <AgentGuardNav />

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === cat
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((faq, i) => {
          const isOpen = openIndex === faqs.indexOf(faq);
          return (
            <Card key={i} className="overflow-hidden">
              <button
                onClick={() => setOpenIndex(isOpen ? null : faqs.indexOf(faq))}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="pr-4 text-sm font-medium text-slate-900">{faq.q}</span>
                <span className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  v
                </span>
              </button>
              {isOpen && (
                <CardContent className="px-4 pt-0 pb-4">
                  <p className="text-sm leading-relaxed text-slate-600">{faq.a}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400">{faq.category}</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <p className="pt-4 text-center text-xs text-slate-400">
        Consult the repository README and your installation administrator for operational guidance.
      </p>
    </div>
  );
}
