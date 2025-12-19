import { DurableObject } from "cloudflare:workers";

export class multiplayerObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("yo", "oy"));
  }

  fetch(request) {
    const [clientSocket, serverSocket] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(serverSocket);
    return new Response(null, { status: 101, webSocket: clientSocket });
  }

  webSocketMessage(serverSocket, message) {
    const strMsg = typeof message === "string"
      ? message
      : new TextDecoder().decode(message);
    const msg = JSON.parse(strMsg);
    const jsonStr = JSON.stringify(msg);
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(jsonStr);
    }
  }

  webSocketClose(serverSocket, code, reason, wasClean) {
    // no-op
  }

  webSocketError(serverSocket, error) {
    console.error(error);
  }
}

function response(code, msg) {
  return new Response(msg, { status: code });
}

function connectToDurableObject(request, env, itemId) {
  const obj = env.MULTIPLAYER_OBJECT;
  const id = obj.idFromName(itemId);
  const stub = obj.get(id);
  return stub.fetch(request);
}

function isWebSocketConnection(request) {
  return request.headers.get("Upgrade") === "websocket";
}

function handle(request, env, ctx) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const itemId = params.get("item_id");
  const sessionId = params.get("session_id");

  if (url.pathname !== "/api/multiplayer") {
    return response(404);
  }
  if (!isWebSocketConnection(request)) {
    return response(400, "websocket expected");
  }
  if (itemId && sessionId) {
    return connectToDurableObject(request, env, itemId);
  }
  return response(404);
}

function html(url) {
  const itemId = "b843a508-eb21-45fe-bf4c-276e520d1735";
  const sessionId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const wsUrl = `ws://${url.host}/api/multiplayer?item_id=${itemId}&session_id=${sessionId}&version=50&user_id=${userId}`;

  return `<!DOCTYPE html>
<html>
<head>
  <title>Cursor Sync - JS Debug</title>
  <style>
    body {
      margin: 0;
      height: 100vh;
      background: #1a1a2e;
      overflow: hidden;
      font-family: system-ui, sans-serif;
    }
    .cursor {
      position: absolute;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      pointer-events: none;
      transform: translate(-50%, -50%);
      transition: left 0.05s, top 0.05s;
    }
    .info {
      position: fixed;
      top: 20px;
      left: 20px;
      color: #fff;
      background: rgba(0,0,0,0.5);
      padding: 15px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 100;
    }
    .info div { margin: 5px 0; }
    .status { color: #4ade80; }
    .status.disconnected { color: #f87171; }
  </style>
</head>
<body>
  <div class='info'>
    <div><strong>Cursor Sync - JS Debug</strong></div>
    <div>Status: <span class='status' id='status'>Connecting...</span></div>
    <div>Messages sent: <span id='sent'>0</span></div>
    <div>Messages received: <span id='received'>0</span></div>
    <div>Open this page in multiple browser windows and move your cursor.</div>
  </div>

  <script>
    const ACTION_UPDATE_POINTER = 1;
    const clientId = Math.floor(Math.random() * 1000) + 1;
    const cursors = {};
    let ws;
    let sent = 0;
    let received = 0;

    // Encode cursor update as JSON with client ID
    function encodeCursorUpdate(x, y) {
      return JSON.stringify({ action: ACTION_UPDATE_POINTER, clientId, x, y });
    }

    // Decode JSON message from server
    function decodeMessage(jsonStr) {
      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        console.log('Failed to parse JSON:', e);
        return null;
      }
    }

    function connect() {
      ws = new WebSocket('${wsUrl}');

      ws.onopen = () => {
        document.getElementById('status').textContent = 'Connected';
        document.getElementById('status').className = 'status';
      };

      ws.onclose = () => {
        document.getElementById('status').textContent = 'Disconnected - reconnecting...';
        document.getElementById('status').className = 'status disconnected';
        setTimeout(connect, 1000);
      };

      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        // Skip 'oy' pong response
        if (event.data === 'oy') {
          return;
        }

        const data = decodeMessage(event.data);
        if (!data) return;

        // Only handle cursor updates
        if (data.action !== ACTION_UPDATE_POINTER) {
          console.log('Non-cursor action:', data.action);
          return;
        }

        // Skip our own cursor
        if (data.clientId === clientId) {
          return;
        }

        received++;
        document.getElementById('received').textContent = received;

        if (!cursors[data.clientId]) {
          const el = document.createElement('div');
          el.className = 'cursor';
          // Generate consistent color from clientId
          el.style.background = 'hsl(' + (data.clientId * 137 % 360) + ', 70%, 50%)';
          document.body.appendChild(el);
          cursors[data.clientId] = el;
        }

        cursors[data.clientId].style.left = data.x + 'px';
        cursors[data.clientId].style.top = data.y + 'px';
      };
    }

    document.addEventListener('mousemove', (e) => {
      if (ws && ws.readyState === 1) {
        sent++;
        document.getElementById('sent').textContent = sent;
        ws.send(encodeCursorUpdate(e.clientX, e.clientY));
      }
    });

    connect();
  </script>
</body>
</html>`;
}

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return new Response(html(url), { headers: { "Content-Type": "text/html" } });
    }
    return handle(request, env, ctx);
  }
};
