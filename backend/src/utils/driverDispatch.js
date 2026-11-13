const approvalRequired = process.env.REQUIRE_DRIVER_APPROVAL === 'true'

export function canDriverReceiveDispatch(driver) {
  if (!driver?.isEmailVerified || driver.status === 'SUSPENDED' || driver.status === 'PENDING_DOCUMENTS') return false
  if (driver.status === 'ACTIVE') return true
  if (driver.status === 'PENDING_REVIEW') {
    return !approvalRequired
  }
  return false
}

