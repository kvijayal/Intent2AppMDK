// Shared MCP tool-result helpers (the protocol expects a `content` array).
export const okText = (text) => ({ content: [{ type: "text", text }] });
export const errText = (text) => ({ content: [{ type: "text", text: "ERROR: " + text }], isError: true });
export const jsonText = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
