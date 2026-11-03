import { API_URL } from "../services/api";
import { useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CHAT_KEY,
  WELCOME,
  initialMessages,
  cleanHistory,
  readReply,
  backendError,
} from "./chatData";

const suggestions = [
  ["☁", "Explore weather", "What is the weather in Medellín, Colombia?"],
  [
    "◎",
    "Understand earthquakes",
    "Explain earthquake magnitude and depth in simple terms.",
  ],
  [
    "✦",
    "Read the signals",
    "What should I consider when interpreting weather forecasts?",
  ],
];

export default function AIChat({ draft = "" }) {
  const [messages, setMessages] = useState(() => {
    try {
      return cleanHistory(JSON.parse(localStorage.getItem(CHAT_KEY)));
    } catch {
      return initialMessages();
    }
  });
  const [input, setInput] = useState(draft);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const requestRef = useRef(null);
  const transcriptRef = useRef(null);
  const inputRef = useRef(null);
  const followRef = useRef(true);
  const composerId = useId();
  const isWelcome =
    messages.length === 1 &&
    messages[0].role === "assistant" &&
    messages[0].content === WELCOME;

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-200)));
      // oxlint-disable-next-line react/set-state-in-effect -- Synchronizes the result of external localStorage I/O.
      setStorageError(false);
    } catch {
      // oxlint-disable-next-line react/set-state-in-effect -- Reports an external storage failure.
      setStorageError(true);
    }
  }, [messages]);
  useEffect(
    () => () => {
      requestRef.current?.abort();
      requestRef.current = null;
    },
    [],
  );
  useEffect(() => {
    if (transcriptRef.current) {
      if (isWelcome) transcriptRef.current.scrollTop = 0;
      else if (followRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, pending, failure, isWelcome]);

  const jumpToLatest = () => {
    followRef.current = true;
    setAtBottom(true);
    if (transcriptRef.current)
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  };
  function newChat() {
    requestRef.current?.abort();
    requestRef.current = null;
    setPending(false);
    setFailure(null);
    setCopyStatus("");
    setMessages(initialMessages());
    setInput("");
    followRef.current = true;
    setAtBottom(true);
    inputRef.current?.focus();
  }

  async function requestReply(text, history, appendUser = true) {
    if (!text.trim() || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 90000);
    setPending(true);
    setFailure(null);
    setCopyStatus("");
    followRef.current = true;
    setAtBottom(true);
    if (appendUser) {
      setMessages((previous) => [...previous, { role: "user", content: text }]);
      setInput("");
    }
    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(backendError(data));
      const reply = readReply(data);
      if (requestRef.current === controller)
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: reply },
        ]);
    } catch (error) {
      if (requestRef.current === controller)
        setFailure({
          text,
          history,
          message: timedOut
            ? "The assistant took too long to respond. You can retry this message."
            : controller.signal.aborted
              ? "Response stopped. You can retry this message."
              : error.message || "Unable to connect. Please retry.",
        });
    } finally {
      clearTimeout(timer);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPending(false);
      }
    }
  }
  const send = () => {
    if (input.trim() && !requestRef.current)
      requestReply(input.trim(), cleanHistory(messages));
  };
  async function copyAnswer(content, index) {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus(`Response ${index + 1} copied.`);
    } catch {
      setCopyStatus("Copy unavailable. Select the response text to copy it.");
    }
  }

  return (
    <section className="nx-chat" aria-label="NEXUS AI conversation">
      <header className="nx-chat-header">
        <div className="nx-chat-identity">
          <span aria-hidden="true">✦</span>
          <div>
            <p className="nx-eyebrow">NEXUS / INTELLIGENCE ASSISTANT</p>
            <h3>A clearer view of the signals.</h3>
          </div>
        </div>
        <button className="nx-button" type="button" onClick={newChat}>
          ＋ New chat
        </button>
      </header>
      <div className="nx-chat-context">
        <span>EARTH · WEATHER · EXPLANATIONS</span>
        <span>
          {storageError
            ? "History could not be saved on this device"
            : "History saved on this device"}
        </span>
      </div>
      <div
        className="nx-chat-transcript"
        ref={transcriptRef}
        role="region"
        aria-label="Conversation history"
        tabIndex={0}
        onScroll={(event) => {
          const element = event.currentTarget;
          const near =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            60;
          followRef.current = near;
          setAtBottom(near);
        }}
      >
        {isWelcome ? (
          <div className="nx-chat-welcome">
            <span className="nx-chat-emblem" aria-hidden="true">
              ✦
            </span>
            <p className="nx-eyebrow">YOUR NEXT QUESTION STARTS HERE</p>
            <h4>Turn curiosity into understanding.</h4>
            <p>
              Ask about a city, explore seismic concepts, or get help
              interpreting the information in NEXUS.
            </p>
            <div className="nx-chat-suggestions">
              {suggestions.map(([icon, title, question]) => (
                <button
                  type="button"
                  key={title}
                  disabled={pending}
                  onClick={() => {
                    setInput(question);
                    inputRef.current?.focus();
                  }}
                >
                  <span aria-hidden="true">{icon}</span>
                  <strong>{title}</strong>
                  <small>{question}</small>
                  <span className="nx-chat-suggestion-arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <article
              key={index}
              className={`nx-chat-message ${message.role === "user" ? "nx-chat-user" : "nx-chat-assistant"}`}
            >
              <header>
                <span>{message.role === "user" ? "YOU" : "✦ NEXUS AI"}</span>
                {message.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() => copyAnswer(message.content, index)}
                    aria-label={`Copy assistant response ${index + 1}`}
                  >
                    Copy
                  </button>
                )}
              </header>
              <div className="nx-chat-prose">
                {message.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                      table: ({ children }) => (
                        <div
                          className="nx-chat-table-wrap"
                          role="region"
                          aria-label="Response table"
                          tabIndex={0}
                        >
                          <table>{children}</table>
                        </div>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            </article>
          ))
        )}
        {pending && (
          <div className="nx-chat-thinking" aria-hidden="true">
            <span>✦</span>
            <p>Waiting for NEXUS AI…</p>
            <i />
            <i />
            <i />
          </div>
        )}
        {failure && (
          <div className="nx-chat-error" role="alert">
            <p>{failure.message}</p>
            <button
              className="nx-button"
              type="button"
              disabled={pending}
              onClick={() => requestReply(failure.text, failure.history, false)}
            >
              ↻ Retry message
            </button>
          </div>
        )}
      </div>
      {!atBottom && !isWelcome && (
        <button
          className="nx-chat-latest nx-button"
          type="button"
          onClick={jumpToLatest}
        >
          ↓ Latest messages
        </button>
      )}
      <div className="nx-chat-announcement" role="status">
        {pending
          ? "Request in progress. You can stop it below."
          : copyStatus ||
            (failure
              ? "Message was not answered."
              : "Ready for your question.")}
      </div>
      <form
        className="nx-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label className="nx-sr-only" htmlFor={composerId}>
          Message NEXUS AI
        </label>
        <textarea
          id={composerId}
          ref={inputRef}
          rows={3}
          maxLength={12000}
          placeholder="Ask about a city, a seismic event, or a weather concept…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              send();
            }
          }}
        />
        <div className="nx-chat-composer-footer">
          <span>Enter to send · Shift + Enter for a new line</span>
          {pending ? (
            <button
              className="nx-button"
              type="button"
              onClick={() => requestRef.current?.abort()}
            >
              ■ Stop response
            </button>
          ) : (
            <button
              className="nx-button nx-primary"
              type="submit"
              disabled={!input.trim()}
            >
              Send message ↑
            </button>
          )}
        </div>
      </form>
      <p className="nx-chat-note">
        AI responses may contain errors. Check measurements and sources before
        relying on an answer.
      </p>
    </section>
  );
}
