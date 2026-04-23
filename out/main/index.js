"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const url = require("url");
const fs = require("fs");
const GOOGLE_CLIENT_ID = "ЗАМЕНИТЕ НА ВАШ";
const GOOGLE_CLIENT_SECRET = "ЗАМЕНИТЕ НА ВАШ";
const REDIRECT_PORT = 42813;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me",
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/classroom.announcements",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
  "profile"
].join(" ");
function generateCodeVerifier() {
  return crypto.randomBytes(64).toString("base64url");
}
async function generateCodeChallenge(verifier) {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return Buffer.from(hash).toString("base64url");
}
async function startOAuthFlow() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = new url.URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith("/callback")) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      const reqUrl = new url.URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      const code = reqUrl.searchParams.get("code");
      const returnedState = reqUrl.searchParams.get("state");
      const error = reqUrl.searchParams.get("error");
      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<html><body><h2>Authentication failed. You may close this window.</h2></body></html>");
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }
      if (!code || returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<html><body><h2>Invalid callback. You may close this window.</h2></body></html>");
        server.close();
        reject(new Error("Invalid OAuth callback: missing code or state mismatch"));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h2>Authentication successful! You may close this window.</h2></body></html>");
      server.close();
      try {
        const tokens = await handleOAuthCallback(code, codeVerifier);
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    });
    server.listen(REDIRECT_PORT, "127.0.0.1", () => {
      electron.shell.openExternal(authUrl.toString()).catch(reject);
    });
    server.on("error", (err) => {
      reject(new Error(`Failed to start OAuth callback server: ${err.message}`));
    });
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth flow timed out"));
    }, 5 * 60 * 1e3);
  });
}
async function handleOAuthCallback(code, codeVerifier) {
  if (!codeVerifier) {
    throw new Error("code_verifier is empty!");
  }
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
    code_verifier: codeVerifier
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`Token exchange failed: ${response.status} ${JSON.stringify(errorBody)}`);
  }
  const tokens = await response.json();
  tokens.expiry_date = Date.now() + tokens.expires_in * 1e3;
  return tokens;
}
async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token"
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorBody}`);
  }
  const tokens = await response.json();
  tokens.expiry_date = Date.now() + tokens.expires_in * 1e3;
  return tokens;
}
const TOKEN_FILE = "tokens.bin";
function getTokenPath() {
  return path.join(electron.app.getPath("userData"), TOKEN_FILE);
}
function saveTokens(tokens) {
  const json = JSON.stringify(tokens);
  const tokenPath = getTokenPath();
  if (electron.safeStorage.isEncryptionAvailable()) {
    const encrypted = electron.safeStorage.encryptString(json);
    fs.writeFileSync(tokenPath, encrypted);
  } else {
    fs.writeFileSync(tokenPath, Buffer.from(json).toString("base64"), "utf-8");
  }
}
function getTokens() {
  const tokenPath = getTokenPath();
  if (!fs.existsSync(tokenPath)) {
    return null;
  }
  try {
    if (electron.safeStorage.isEncryptionAvailable()) {
      const encrypted = fs.readFileSync(tokenPath);
      const json = electron.safeStorage.decryptString(encrypted);
      return JSON.parse(json);
    } else {
      const b64 = fs.readFileSync(tokenPath, "utf-8");
      const json = Buffer.from(b64, "base64").toString("utf-8");
      return JSON.parse(json);
    }
  } catch {
    return null;
  }
}
function clearTokens() {
  const tokenPath = getTokenPath();
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
  }
}
const BASE_URL = "https://classroom.googleapis.com/v1";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3";
class ClassroomApiError extends Error {
  status;
  body;
  constructor(status, body) {
    const sanitized = body.length > 400 ? `${body.slice(0, 400)}…` : body;
    super(`Classroom API error ${status}: ${sanitized}`);
    this.name = "ClassroomApiError";
    this.status = status;
    this.body = body;
  }
}
async function classroomFetch(path2, accessToken, options) {
  const response = await fetch(`${BASE_URL}${path2}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers ?? {}
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new ClassroomApiError(response.status, body);
  }
  if (response.status === 204) {
    return {};
  }
  const text = await response.text();
  if (!text) {
    return {};
  }
  return JSON.parse(text);
}
async function getCourses(accessToken) {
  const data = await classroomFetch("/courses?courseStates=ACTIVE", accessToken);
  return data.courses ?? [];
}
async function getCourseWork(courseId, accessToken) {
  const data = await classroomFetch(
    `/courses/${courseId}/courseWork?orderBy=dueDate+desc`,
    accessToken
  );
  return data.courseWork ?? [];
}
async function getSubmissions(courseId, courseWorkId, accessToken) {
  const data = await classroomFetch(
    `/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`,
    accessToken
  );
  return data.studentSubmissions ?? [];
}
async function getMySubmission(courseId, courseWorkId, accessToken) {
  const data = await classroomFetch(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions?userId=me`,
    accessToken
  );
  return data.studentSubmissions?.[0] ?? null;
}
async function getAnnouncements(courseId, accessToken) {
  const data = await classroomFetch(
    `/courses/${courseId}/announcements?orderBy=updateTime+desc`,
    accessToken
  );
  return data.announcements ?? [];
}
async function getStudents(courseId, accessToken) {
  const data = await classroomFetch(
    `/courses/${courseId}/students`,
    accessToken
  );
  return data.students ?? [];
}
async function submitAssignment(courseId, courseWorkId, submissionId, accessToken) {
  return classroomFetch(
    `/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}:turnIn`,
    accessToken,
    { method: "POST", body: "{}" }
  );
}
async function unsubmitAssignment(courseId, courseWorkId, submissionId, accessToken) {
  return classroomFetch(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions/${encodeURIComponent(submissionId)}:reclaim`,
    accessToken,
    { method: "POST", body: "{}" }
  );
}
async function addSubmissionAttachments(courseId, courseWorkId, submissionId, attachments, accessToken) {
  return classroomFetch(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions/${encodeURIComponent(submissionId)}:modifyAttachments`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        addAttachments: attachments
      })
    }
  );
}
async function removeSubmissionAttachments(courseId, courseWorkId, submissionId, attachmentIds, accessToken) {
  if (attachmentIds.length === 0) {
    throw new Error("Cannot remove attachments: no attachment IDs provided.");
  }
  return classroomFetch(
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions/${encodeURIComponent(submissionId)}:modifyAttachments`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        removeAttachments: attachmentIds
      })
    }
  );
}
async function uploadDriveFile(file, accessToken) {
  const metadata = {
    name: file.name,
    mimeType: file.mimeType
  };
  const boundary = `boundary_${crypto.randomBytes(24).toString("hex")}`;
  const delimiter = `--${boundary}`;
  const closeDelimiter = `--${boundary}--`;
  const body = `${delimiter}\r
Content-Type: application/json; charset=UTF-8\r
\r
${JSON.stringify(metadata)}\r
${delimiter}\r
Content-Type: ${file.mimeType || "application/octet-stream"}\r
Content-Transfer-Encoding: base64\r
\r
${file.contentBase64}\r
${closeDelimiter}`;
  const response = await fetch(DRIVE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Drive upload failed ${response.status}: ${errText}`);
  }
  const uploaded = await response.json();
  const detailsRes = await fetch(
    `${DRIVE_API_URL}/files/${encodeURIComponent(uploaded.id)}?fields=id,name,webViewLink`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  if (!detailsRes.ok) {
    return { id: uploaded.id };
  }
  return await detailsRes.json();
}
async function uploadDriveFilesAsAttachments(files, accessToken) {
  const attachments = [];
  for (const file of files) {
    const uploaded = await uploadDriveFile(file, accessToken);
    attachments.push({
      driveFile: {
        id: uploaded.id,
        title: uploaded.name,
        alternateLink: uploaded.webViewLink
      }
    });
  }
  return attachments;
}
function getPluginsDir() {
  if (electron.app.isPackaged) {
    return path.join(process.resourcesPath, "plugins");
  }
  return path.join(electron.app.getAppPath(), "plugins");
}
async function loadPlugins() {
  const pluginsDir = getPluginsDir();
  const registry = { plugins: [] };
  if (!fs.existsSync(pluginsDir)) {
    return registry;
  }
  let entries;
  try {
    entries = fs.readdirSync(pluginsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return registry;
  }
  for (const entry of entries) {
    const pluginPath = path.join(pluginsDir, entry, "index.js");
    if (!fs.existsSync(pluginPath)) continue;
    try {
      const mod = require(pluginPath);
      if (!mod.id || !mod.name || typeof mod.init !== "function") {
        console.warn(`[plugin-loader] Skipping invalid plugin at ${pluginPath}`);
        continue;
      }
      const plugin = {
        id: mod.id,
        name: mod.name,
        version: mod.version ?? "0.0.0",
        panels: [],
        coursePageExtensions: [],
        actions: []
      };
      const api = {
        addPanel: (panel) => plugin.panels.push(panel),
        extendCoursePage: (ext) => plugin.coursePageExtensions.push(ext),
        addAction: (action) => plugin.actions.push(action)
      };
      mod.init(api);
      registry.plugins.push(plugin);
      console.log(`[plugin-loader] Loaded plugin: ${mod.name} v${plugin.version}`);
    } catch (err) {
      console.error(`[plugin-loader] Failed to load plugin at ${pluginPath}:`, err);
    }
  }
  return registry;
}
class ExtensionManager {
  extensions = /* @__PURE__ */ new Map();
  registerExtension(extension) {
    this.extensions.set(extension.id, extension);
  }
  getExtensionsFor(type) {
    return Array.from(this.extensions.values()).filter((extension) => extension.supports.includes(type)).map((extension) => ({
      id: extension.id,
      name: extension.name,
      description: extension.description,
      supports: extension.supports
    }));
  }
  async runExtension(id, context) {
    const extension = this.extensions.get(id);
    if (!extension) {
      throw new Error(`Extension not found: ${id}`);
    }
    return extension.run(context);
  }
}
const OPENROUTER_URL$1 = "https://openrouter.ai/api/v1/chat/completions";
function buildPrompt(context) {
  const materialUrls = context.materials?.flatMap((material) => [
    material.link?.url,
    material.driveFile?.driveFile?.alternateLink,
    material.youtubeVideo?.alternateLink,
    material.form?.formUrl
  ]).filter((url2) => Boolean(url2)).join("\n") ?? "";
  return [
    "You are a study assistant for Google Classroom assignments.",
    "Explain tasks and provide non-cheating hints.",
    "Do NOT submit forms, auto-fill answers, or bypass authentication.",
    "",
    `Title: ${context.title}`,
    `Description: ${context.description ?? "N/A"}`,
    `Course ID: ${context.courseId}`,
    `Course Work ID: ${context.courseWorkId ?? "N/A"}`,
    `Google Form URL: ${context.formUrl ?? "N/A"}`,
    "",
    "Materials:",
    materialUrls || "No materials",
    "",
    "Return JSON with shape:",
    '{ "summary": string, "hints": string[] }',
    "Hints should explain how to solve tasks and summarize requirements."
  ].join("\n");
}
async function callOpenRouter(context) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is not set. Please configure it before using the Form Assistant extension."
    );
  }
  const response = await fetch(OPENROUTER_URL$1, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b:free",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You provide educational explanations and safe study hints only."
        },
        {
          role: "user",
          content: buildPrompt(context)
        }
      ]
    })
  });
  if (!response.ok) {
    throw new Error(
      `OpenRouter API request failed with status ${response.status} (${response.statusText}).`
    );
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content) {
    return { summary: "No response received from assistant.", hints: [] };
  }
  try {
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary ?? "No summary provided.",
      hints: Array.isArray(parsed.hints) ? parsed.hints : [],
      raw: parsed
    };
  } catch {
    return {
      summary: content,
      hints: [],
      raw: content
    };
  }
}
const formAssistantExtension = {
  id: "form-assistant",
  name: "Form Assistant",
  description: "Analyzes assignment/form context and returns explanations and hints.",
  supports: ["courseWork"],
  run: async (context) => {
    return callOpenRouter(context);
  }
};
function getNotebookHint(context) {
  if (context.title.toLowerCase().includes("math") || context.title.toLowerCase().includes("geometry")) {
    return "Use grid paper mode for calculations and diagrams.";
  }
  return "Use ruled paper mode for structured notes and key points.";
}
const notebookExtension = {
  id: "notebook-extension",
  name: "Notebook Extension",
  description: "Provides notebook guidance for the current assignment.",
  supports: ["courseWork", "notebook"],
  run: async (context) => {
    return {
      summary: `Notebook workspace is ready for "${context.title}".`,
      hints: [getNotebookHint(context), "Attach your notebook page when submitting if needed."]
    };
  }
};
const achievementsExtension = {
  id: "achievements-extension",
  name: "Achievements Extension",
  description: "Highlights progress-oriented goals for assignment completion.",
  supports: ["courseWork"],
  run: async (context) => {
    return {
      summary: `Complete "${context.title}" to improve your submission streak.`,
      hints: ["Submit before the deadline to progress the Deadline Survivor achievement."]
    };
  }
};
const studyMaterialAiExtension = {
  id: "study-material-ai-extension",
  name: "Study Material AI Extension",
  description: "Runs restricted tutoring against uploaded study materials.",
  supports: ["courseWork", "notebook"],
  run: async (_context) => {
    return {
      summary: "Use Study Material Mode to ask questions only against uploaded books and notes.",
      hints: ["If source material does not contain the answer, the assistant should return Not found in study materials."]
    };
  }
};
const submissionExtension = {
  id: "submission-extension",
  name: "Submission Extension",
  description: "Guides safe manual submission workflow.",
  supports: ["courseWork"],
  run: async (context) => {
    return {
      summary: `Review attachments and submit "${context.title}" manually when ready.`,
      hints: [
        "Add links, files, or notebook content before turning in.",
        "Submission is always user-triggered; no automatic turn-in occurs."
      ]
    };
  }
};
const extensionManager = new ExtensionManager();
extensionManager.registerExtension(formAssistantExtension);
extensionManager.registerExtension(notebookExtension);
extensionManager.registerExtension(achievementsExtension);
extensionManager.registerExtension(studyMaterialAiExtension);
extensionManager.registerExtension(submissionExtension);
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
function sanitizeChunkText(text) {
  return text.replace(/\s+/g, " ").trim();
}
function scoreChunk(question, text) {
  const qTerms = question.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  if (qTerms.length === 0) return 0;
  const lowerText = text.toLowerCase();
  return qTerms.reduce((acc, term) => lowerText.includes(term) ? acc + 1 : acc, 0);
}
async function askStudyMaterialAI(question, chunks) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) {
    return { answer: "Not found in study materials", usedChunkIds: [] };
  }
  const ranked = chunks.map((chunk) => ({ chunk, score: scoreChunk(cleanQuestion, chunk.text) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  if (ranked.length === 0) {
    return { answer: "Not found in study materials", usedChunkIds: [] };
  }
  const contextBlock = ranked.map(
    (item, index) => `[Chunk ${index + 1} | source=${item.chunk.sourceName} | id=${item.chunk.id}]
${sanitizeChunkText(item.chunk.text)}`
  ).join("\n\n");
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is not set. Please set it in your .env file or system environment variables."
    );
  }
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: 'You are a restricted tutor. Answer ONLY from provided study material chunks. If evidence is insufficient, answer exactly: "Not found in study materials". Do not use outside knowledge.'
        },
        {
          role: "user",
          content: `Question: ${cleanQuestion}

Study Material Chunks:
${contextBlock}`
        }
      ]
    })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed ${response.status}: ${body}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return { answer: "Not found in study materials", usedChunkIds: ranked.map((x) => x.chunk.id) };
  }
  return {
    answer: content,
    usedChunkIds: ranked.map((x) => x.chunk.id)
  };
}
async function getValidAccessToken() {
  const tokens = getTokens();
  if (!tokens) {
    throw new Error("Not authenticated");
  }
  const EXPIRY_BUFFER_MS = 1 * 60 * 1e3;
  const isExpired = tokens.expiry_date != null && Date.now() >= tokens.expiry_date - EXPIRY_BUFFER_MS;
  if (isExpired && tokens.refresh_token) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    if (!refreshed.refresh_token) {
      refreshed.refresh_token = tokens.refresh_token;
    }
    saveTokens(refreshed);
    return refreshed.access_token;
  }
  return tokens.access_token;
}
function registerIpcHandlers() {
  electron.ipcMain.handle("auth:login", async () => {
    const tokens = await startOAuthFlow();
    saveTokens(tokens);
    return { success: true };
  });
  electron.ipcMain.handle("auth:logout", () => {
    clearTokens();
    return { success: true };
  });
  electron.ipcMain.handle("auth:get-status", () => {
    const tokens = getTokens();
    return { isAuthenticated: tokens !== null };
  });
  electron.ipcMain.handle("auth:get-access-token", async () => {
    const accessToken = await getValidAccessToken();
    return { accessToken };
  });
  electron.ipcMain.handle("auth:refresh", async () => {
    const tokens = getTokens();
    if (!tokens?.refresh_token) {
      throw new Error("No refresh token available");
    }
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    if (!refreshed.refresh_token) {
      refreshed.refresh_token = tokens.refresh_token;
    }
    saveTokens(refreshed);
    return { success: true };
  });
  electron.ipcMain.handle("classroom:get-courses", async () => {
    const token = await getValidAccessToken();
    return getCourses(token);
  });
  electron.ipcMain.handle("classroom:get-coursework", async (_event, courseId) => {
    const token = await getValidAccessToken();
    return getCourseWork(courseId, token);
  });
  electron.ipcMain.handle(
    "classroom:get-submissions",
    async (_event, courseId, courseWorkId) => {
      const token = await getValidAccessToken();
      return getSubmissions(courseId, courseWorkId, token);
    }
  );
  electron.ipcMain.handle("classroom:get-announcements", async (_event, courseId) => {
    const token = await getValidAccessToken();
    return getAnnouncements(courseId, token);
  });
  electron.ipcMain.handle("classroom:get-students", async (_event, courseId) => {
    const token = await getValidAccessToken();
    return getStudents(courseId, token);
  });
  electron.ipcMain.handle(
    "classroom:submit-assignment",
    async (_event, courseId, courseWorkId, submissionId) => {
      const token = await getValidAccessToken();
      return submitAssignment(courseId, courseWorkId, submissionId, token);
    }
  );
  electron.ipcMain.handle(
    "classroom:unsubmit-assignment",
    async (_event, courseId, courseWorkId, submissionId) => {
      const token = await getValidAccessToken();
      return unsubmitAssignment(courseId, courseWorkId, submissionId, token);
    }
  );
  electron.ipcMain.handle("classroom:get-my-submission", async (_event, courseId, courseWorkId) => {
    const token = await getValidAccessToken();
    return getMySubmission(courseId, courseWorkId, token);
  });
  electron.ipcMain.handle(
    "classroom:add-submission-attachments",
    async (_event, courseId, courseWorkId, submissionId, attachments) => {
      const token = await getValidAccessToken();
      return addSubmissionAttachments(courseId, courseWorkId, submissionId, attachments, token);
    }
  );
  electron.ipcMain.handle(
    "classroom:remove-submission-attachments",
    async (_event, courseId, courseWorkId, submissionId, attachmentIds) => {
      const token = await getValidAccessToken();
      return removeSubmissionAttachments(courseId, courseWorkId, submissionId, attachmentIds, token);
    }
  );
  electron.ipcMain.handle(
    "classroom:upload-files-as-attachments",
    async (_event, files) => {
      const token = await getValidAccessToken();
      return uploadDriveFilesAsAttachments(files, token);
    }
  );
  electron.ipcMain.handle("shell:open-external", async (_event, url2) => {
    let parsed;
    try {
      parsed = new URL(url2);
    } catch {
      throw new Error("Invalid URL format. Please provide a valid HTTP or HTTPS URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(
        `Unsupported URL protocol '${parsed.protocol}'. Only HTTP and HTTPS URLs are allowed.`
      );
    }
    await electron.shell.openExternal(parsed.toString());
    return { success: true };
  });
  electron.ipcMain.handle("plugins:load", async () => {
    const registry = await loadPlugins();
    return registry.plugins.map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      panels: p.panels,
      coursePageExtensions: p.coursePageExtensions,
      actions: p.actions.map(({ id, label }) => ({ id, label }))
      // omit non-serialisable handler
    }));
  });
  electron.ipcMain.handle("extensions:get-for", (_event, type) => {
    return extensionManager.getExtensionsFor(type);
  });
  electron.ipcMain.handle(
    "extensions:run",
    async (_event, extensionId, context) => {
      return extensionManager.runExtension(extensionId, context);
    }
  );
  electron.ipcMain.handle(
    "study-material:ask",
    async (_event, question, chunks) => {
      return askStudyMaterialAI(question, chunks);
    }
  );
}
exports.mainWindow = null;
function createWindow() {
  exports.mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "OpenClass Beta",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });
  if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    exports.mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    exports.mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  exports.mainWindow.on("closed", () => {
    exports.mainWindow = null;
  });
}
electron.protocol.registerSchemesAsPrivileged([
  { scheme: "openclass", privileges: { secure: true, standard: true } }
]);
electron.app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
