# Google OAuth token key rotation

The application encrypts Google refresh and access tokens with AES-256-GCM using Web Crypto. Each encryption uses a fresh random 12-byte nonce. The ciphertext is stored as `v2.<nonce>.<ciphertext>` and its key ID is stored in a separate column beside it. Legacy `v1.<key_id>.<nonce>.<ciphertext>` rows remain readable; startup migration copies their embedded key IDs into the new columns.

## Rotate keys

1. Generate a new high-entropy key secret and a separate `OAUTH_TOKEN_ROTATION_SECRET`.
2. Configure `OAUTH_TOKEN_ENCRYPTION_KEYS` as a JSON object containing both the old and new IDs/secrets. Set `OAUTH_TOKEN_ENCRYPTION_KEY_ID` to the new ID. Keep the old key available during rotation and rollback. Deploy these bindings/secrets before running the script.
3. Set `APP_BASE_URL` and `OAUTH_TOKEN_ROTATION_SECRET` in the shell used for the one-time maintenance run. Execute `npm run rotate:oauth-keys`.
4. The script requests pages of 10 connections. The Worker decrypts each existing token using its stored key ID, encrypts with the active key, and verifies the new ciphertext decrypts to the same token before updating the row. It skips already-current values and uses compare-and-update guards for concurrent token refreshes.
5. The final page checks that every non-null token is v2 ciphertext with the active key ID. The script exits unsuccessfully if verification finds pending rows; run it again after concurrent OAuth refreshes settle.
6. Retain the old key through the operational rollback window. Remove it from the keyring only after the rotation report is verified and rollback is no longer needed.

The endpoint is `POST /api/admin/rotate-oauth-tokens`, requires the rotation bearer secret and same-origin header, and processes one bounded page per request. It returns counts and cursors only; it never returns token values.
