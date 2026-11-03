export const CHAT_KEY = "nexus-chat";
export const WELCOME = "Hello! I'm NEXUS AI. How can I help you today?";
export const initialMessages = () => [{ role: "assistant", content: WELCOME }];

export function cleanHistory(value) {
  if (!Array.isArray(value)) return initialMessages();
  const valid = value
    .filter(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim(),
    )
    .map(({ role, content }) => ({ role, content }));
  return valid.length ? valid.slice(-200) : initialMessages();
}

export function readReply(value) {
  if (typeof value?.ai_response !== "string" || !value.ai_response.trim())
    throw new Error(
      "The assistant returned an empty or invalid response. Please retry.",
    );
  return value.ai_response;
}

export function backendError(value) {
  return typeof value?.detail === "string" && value.detail.trim()
    ? value.detail
    : "Unable to reach NEXUS AI. Please try again.";
}
