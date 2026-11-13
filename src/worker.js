import {onRequest as onApiRequest} from '../functions/api/[[path]].js';
import {onRequest as onMcpRequest} from '../functions/mcp.js';

export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) return onApiRequest({request, env});
    if (path === '/mcp') return onMcpRequest({request, env});
    return env.ASSETS.fetch(request);
  }
};
