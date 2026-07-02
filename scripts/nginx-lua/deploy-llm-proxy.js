#!/usr/bin/env node
/**
 * deploy-llm-proxy.js
 *
 * 一键部署 /llm 代理到 nginx 服务器（OpenResty）
 *
 * 部署步骤：
 *   1. 上传 xqjn-llm-auth.lua → /www/server/panel/vhost/nginx/lua/
 *   2. 上传 llm-proxy.conf    → /www/server/panel/vhost/nginx/extension/xqjn.top/
 *   3. nginx -t && nginx -s reload
 */

const fs   = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const SSH_HOST  = process.env.NGINX_SSH_HOST || 'xqjn.top'
const REMOTE_NGINX_DIR = '/www/server/panel/vhost/nginx'
const LOCAL_LUA_DIR = path.join(__dirname, 'nginx-lua')

const FILES_TO_UPLOAD = [
    {
        local : path.join(LOCAL_LUA_DIR, 'xqjn-llm-auth.lua'),
        remote: `${REMOTE_NGINX_DIR}/lua/xqjn-llm-auth.lua`,
        mode  : '0644',
    },
    {
        local : path.join(LOCAL_LUA_DIR, 'llm-proxy.conf'),
        remote: `${REMOTE_NGINX_DIR}/extension/xqjn.top/llm-proxy.conf`,
        mode  : '0644',
    },
]

function sh(cmd, opts = {}) {
    console.log(`$ ${cmd}`)
    return execSync(cmd, { stdio: 'inherit', ...opts })
}

function checkFiles() {
    const missing = FILES_TO_UPLOAD.filter(f => !fs.existsSync(f.local))
    if (missing.length) {
        throw new Error('本地文件缺失：\n' + missing.map(f => '  - ' + f.local).join('\n'))
    }
}

function upload() {
    for (const f of FILES_TO_UPLOAD) {
        sh(`scp -p "${f.local}" ${SSH_HOST}:"${f.remote}"`)
        sh(`ssh ${SSH_HOST} "chmod ${f.mode} '${f.remote}'"`)
    }
}

function reloadNginx() {
    sh(`ssh ${SSH_HOST} "nginx -t && nginx -s reload || /etc/init.d/nginx reload"`)
}

;(function main() {
    console.log('=== 部署 xqjn.top /llm 代理 ===')
    checkFiles()

    console.log('\n[1/3] 检查本地文件...OK')

    console.log('\n[2/3] 上传文件到 nginx 服务器...')
    upload()

    console.log('\n[3/3] 重载 nginx...')
    reloadNginx()

    console.log('\n=== 部署完成 ===')
    console.log('\n环境变量：LLM_PROXY_JWT_SECRET=<your-secret> node deploy-llm-proxy.js')
})().catch(e => {
    console.error('部署失败:', e.message)
    process.exit(1)
})
