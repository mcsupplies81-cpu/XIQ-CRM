import { getAuth } from '@clerk/backend'

export function getUserId(req) {
  const { userId } = getAuth(req)
  return userId
}
