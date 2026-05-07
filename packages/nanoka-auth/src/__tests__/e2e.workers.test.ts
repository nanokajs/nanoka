// TODO(#110): このファイルを新規作成する。
// 目的: @nanokajs/auth の全レイヤー（createAuth / loginHandler / refreshHandler / middleware）を
//       実際の D1 + Workers ランタイム上で検証する E2E テスト。
//       既存の create-auth.test.ts（Node ランタイム・fake model）では検証できない
//       「Workers 上での Web Crypto API 動作」「D1 への実際の読み書き」を確認する。
// 内容: 以下の4シナリオを vitest-pool-workers 上で実装する。
//
//   シナリオ1 — 正常ログイン（D1 に実ユーザーを INSERT し /login が 200 を返す）
//     - beforeAll で applyD1Migrations(env.DB, env.TEST_MIGRATIONS) を呼んでテーブルを作成する
//     - beforeEach で DELETE FROM users を実行してテストを分離する
//     - pbkdf2Hasher.hash でパスワードをハッシュ化し、env.DB.prepare(...).bind(...).run() で users に挿入する
//     - d1Adapter(env.DB) と defineModel を使って NanokaModel を構築する
//       （createAuth は NanokaModel<any> を要求するため）
//     - createAuth(...).loginHandler() を Hono アプリに mount して fetch し、
//       レスポンス 200 / body に accessToken と refreshToken が含まれることを検証する
//
//   シナリオ2 — 不正パスワードで 401
//     - 存在するユーザーに対して誤ったパスワードを送り、401 が返ることを検証する
//
//   シナリオ3 — refresh token で新しい access token を取得
//     - ログイン → refreshHandler に refreshToken を送り → 200 / 新 accessToken を検証する
//
//   シナリオ4 — middleware が access token のみ通過させる
//     - /login → accessToken で /protected にアクセス（200）
//     - refreshToken で /protected にアクセス（401）を検証する
//
// 参考: examples/basic/test/e2e.test.ts の applyD1Migrations / env / d1Adapter パターンを踏襲する。
//       cloudflare:test から applyD1Migrations / env をインポートする（SELF は使わない。
//       Workers ルーターを立てず Hono アプリを直接 .request() で呼ぶ形が適切）。

// TODO(#110): 型宣言 — vitest-pool-workers が ProvidedEnv の型を解決するために必要。
//   declare module 'cloudflare:test' {
//     interface ProvidedEnv {
//       DB: D1Database
//       TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
//     }
//   }
//   この宣言がないと env.DB / env.TEST_MIGRATIONS の型が unknown になりコンパイルエラーになる。

// TODO(#110): import 一覧（実装時に追加する）
//   import { applyD1Migrations, env } from 'cloudflare:test'
//   import { d1Adapter, defineModel, t } from '@nanokajs/core'
//   import { Hono } from 'hono'
//   import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
//   import { createAuth } from '../create-auth.js'
//   import { pbkdf2Hasher } from '../hashers/pbkdf2.js'
//   import { verify } from '../jwt.js'
