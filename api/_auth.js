import { createClerkClient } from '@clerk/backend'

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
})

export async function getUserId(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const request = new Request(`${proto}://${host}${req.url}`, {
    method: req.method,
    headers: req.headers,
  })

  const requestState = await clerk.authenticateRequest(request)
  const auth = requestState.toAuth()
  return auth?.userId || null
}

export async function getUserDisplayName(userId) {
  if (!userId) return null
  try {
    const user = await clerk.users.getUser(userId)
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
    return name || user.emailAddresses?.[0]?.emailAddress || userId
  } catch {
    return userId
  }
}
