import { request } from "node:https";
import { URL } from "node:url";

export default async (req: Request, context: any) => {
  const url = new URL(req.url);
  
  // Determine target path
  let path = url.pathname;
  if (path.startsWith('/api/proxy')) {
    path = path.replace('/api/proxy', '');
  } else if (path.startsWith('/.netlify/functions/proxy')) {
    path = path.replace('/.netlify/functions/proxy', '');
  }

  if (path && !path.startsWith('/')) {
    path = '/' + path;
  }

  // Construct target URL
  const targetHost = "api-direct.xiaoqiumi.co";
  const targetPath = `${path}${url.search}`;
  
  console.log(`[Proxy] ${req.method} ${targetPath} -> https://${targetHost}${targetPath}`);

  // Prepare body
  let body: Buffer | null = null;
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    try {
      const arrayBuffer = await req.arrayBuffer();
      body = Buffer.from(arrayBuffer);
    } catch (e) {
      console.error("Error reading request body:", e);
    }
  }

  // Prepare headers
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    // Filter out headers
    if (["host", "connection", "content-length", "cookie"].includes(key.toLowerCase())) return;
    headers[key] = value;
  });

  // Set required headers
  headers["Referer"] = "https://h5static.xiaoqiumi.com/";
  headers["Origin"] = "https://h5static.xiaoqiumi.com";
  headers["Host"] = targetHost;
  if (!headers["User-Agent"]) {
    headers["User-Agent"] = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
  }

  // If we have a body, set content-length
  if (body) {
    headers["Content-Length"] = String(body.length);
  }

  return new Promise((resolve) => {
    const options = {
      hostname: targetHost,
      port: 443,
      path: targetPath,
      method: req.method,
      headers: headers,
      rejectUnauthorized: false, // DANGER: Ignore SSL certificate errors (Expired Cert)
    };

    const proxyReq = request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const responseBody = Buffer.concat(chunks);
        
        // Prepare response headers
        const responseHeaders = new Headers();
        if (res.headers) {
          for (const [key, value] of Object.entries(res.headers)) {
            if (Array.isArray(value)) {
              value.forEach(v => responseHeaders.append(key, v));
            } else if (value) {
              responseHeaders.set(key, value);
            }
          }
        }

        // Set CORS
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, deviceid, product, usertoken, versions, source, lytime, priority");

        resolve(new Response(responseBody, {
          status: res.statusCode || 200,
          statusText: res.statusMessage || "OK",
          headers: responseHeaders
        }));
      });
    });

    proxyReq.on("error", (e) => {
      console.error("[Proxy Error]", e);
      resolve(new Response(JSON.stringify({ error: "Proxy failed", details: e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      }));
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
};
