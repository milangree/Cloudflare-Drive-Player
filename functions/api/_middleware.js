// API 统一中间件：处理 CORS 跨域预检与后端未捕获异常保护
// 生效作用域：仅限 /api/* 接口调用，不影响静态资源直通 CDN 传输
export async function onRequest(context) {
  const { request, next } = context;

  // 处理 OPTIONS 预检请求
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Range, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const response = await next();
    // 为所有 API 响应添加宽松的 CORS 标头，方便移动端或第三方嵌入
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Disposition");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (err) {
    // 原始错误只进服务端日志；响应体回固定文案，避免把内部路径、堆栈或凭据细节回吐给客户端
    console.error("[api-middleware] unhandled error:", err && (err.stack || err.message));
    return new Response(
      JSON.stringify({
        success: false,
        error: "服务器内部错误，请稍后重试。",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
