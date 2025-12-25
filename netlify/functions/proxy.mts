// Using standard Web API types which are available in Netlify Functions v2 (Node 18+)
// No external imports to avoid build errors if @netlify/functions is not installed.

export default async (req: Request, context: any) => {
  // Parse the request URL
  const url = new URL(req.url);
  
  // Logic to determine the target path
  // We expect requests like: /api/proxy/api/MatchInfo?param=value
  // We want to fetch: https://api-direct.xiaoqiumi.co/api/MatchInfo?param=value
  
  // Remove the proxy prefix
  let path = url.pathname;
  if (path.startsWith('/api/proxy')) {
    path = path.replace('/api/proxy', '');
  } else if (path.startsWith('/.netlify/functions/proxy')) {
    // Fallback if the rewrite behaves differently
    path = path.replace('/.netlify/functions/proxy', '');
  }

  // Ensure path starts with / if not empty
  if (path && !path.startsWith('/')) {
    path = '/' + path;
  }

  // Construct target URL
  const targetUrl = `https://api-direct.xiaoqiumi.co${path}${url.search}`;
  
  console.log(`[Proxy] ${req.method} ${url.pathname} -> ${targetUrl}`);

  // Prepare headers for the upstream request
  const headers = new Headers(req.headers);
  
  // Clean up headers that shouldn't be forwarded or need override
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length"); // Let fetch calculate this
  headers.delete("cookie"); // Privacy: don't forward cookies unless necessary
  
  // Set the specific headers required by the Small Fan API
  headers.set("Referer", "https://h5static.xiaoqiumi.com/");
  headers.set("Origin", "https://h5static.xiaoqiumi.com");
  headers.set("Host", "api-direct.xiaoqiumi.co");
  
  // Common browser headers simulation
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36");
  }

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      // @ts-ignore
      duplex: 'half' // Required for Node.js fetch with body
    });

    // Prepare response headers
    const responseHeaders = new Headers(response.headers);
    
    // Ensure CORS headers are set for the frontend
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, deviceid, product, usertoken, versions, source, lytime, priority");
    
    // Handle OPTIONS preflight immediately
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: responseHeaders
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
    
  } catch (error: any) {
    console.error("[Proxy Error]", error);
    return new Response(JSON.stringify({ error: "Proxy failed", details: error.message }), {
      status: 502,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
};
