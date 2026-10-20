import { getAccessToken } from "../../utils/googleAuth.js";
import { verifyAdminToken } from "../../utils/configManager.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. 严格管理员鉴权
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const isAdmin = await verifyAdminToken(token, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ success: false, error: "未授权的管理员操作" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const googleToken = await getAccessToken(env);
    const body = await request.json();
    const { action, fileId, newName, targetFolderId, parentFolderId } = body;

    // 动作 1：重命名文件或文件夹
    if (action === "rename") {
      if (!fileId || !newName || !newName.trim()) {
        return new Response(JSON.stringify({ success: false, error: "缺少文件 ID 或新名称" }), { status: 400 });
      }

      const patchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`;
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google Drive API 重命名失败: ${errText}`);
      }

      return new Response(JSON.stringify({ success: true, message: "重命名成功" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 动作：测试或更新 description / appProperties
    if (action === "test_meta") {
      const patchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,name,description,appProperties,properties`;
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: "CF_CONFIG_TEST:" + Date.now(),
          properties: { testKey: "testValue" },
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify({ success: res.ok, status: res.status, data }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 动作 2：移动文件或文件夹
    if (action === "move") {
      if (!fileId || !targetFolderId) {
        return new Response(JSON.stringify({ success: false, error: "缺少文件 ID 或目标文件夹 ID" }), { status: 400 });
      }

      // 提取文件当前所在父级
      let removeParents = "";
      try {
        const getUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=parents`;
        const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${googleToken}` } });
        if (getRes.ok) {
          const fileInfo = await getRes.json();
          if (fileInfo.parents && fileInfo.parents.length > 0) {
            removeParents = fileInfo.parents.join(",");
          }
        }
      } catch (_) {}

      const moveUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
      moveUrl.searchParams.set("supportsAllDrives", "true");
      moveUrl.searchParams.set("addParents", targetFolderId);
      if (removeParents) {
        moveUrl.searchParams.set("removeParents", removeParents);
      }

      const res = await fetch(moveUrl.toString(), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google Drive API 移动失败: ${errText}`);
      }

      return new Response(JSON.stringify({ success: true, message: "移动成功" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 动作 3：删除文件或文件夹 (移入回收站或直接删除)
    if (action === "delete") {
      if (!fileId) {
        return new Response(JSON.stringify({ success: false, error: "缺少待删除文件 ID" }), { status: 400 });
      }

      // 安全起见先移入回收站 trashed = true，支持物理彻底删除 (永久删除)
      const isPermanent = body.permanent === true;

      let res;
      if (isPermanent) {
        const delUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`;
        res = await fetch(delUrl, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${googleToken}` },
        });
      } else {
        const trashUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`;
        res = await fetch(trashUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trashed: true }),
        });
      }

      if (!res.ok && res.status !== 204) {
        const errText = await res.text();
        throw new Error(`Google Drive API 删除失败: ${errText}`);
      }

      return new Response(JSON.stringify({ success: true, message: isPermanent ? "永久删除成功" : "已移入回收站" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 动作 4：新建文件夹
    if (action === "create_folder") {
      const folderName = body.name ? body.name.trim() : "";
      const parent = body.parentFolderId || "root";
      if (!folderName) {
        return new Response(JSON.stringify({ success: false, error: "文件夹名称不能为空" }), { status: 400 });
      }

      const createUrl = "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true";
      const res = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parent],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google Drive API 创建文件夹失败: ${errText}`);
      }

      const newFolder = await res.json();
      return new Response(JSON.stringify({ success: true, message: "创建成功", folder: newFolder }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "不支持的操作指令" }), { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
