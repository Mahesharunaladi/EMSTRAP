const approvalRequired = process.env.REQUIRE_DRIVER_APPROVAL === 'true'

export function canDriverReceiveDispatch(driver) {
  if (!driver?.isEmailVerified || driver.status === 'SUSPENDED' || driver.status === 'PENDING_DOCUMENTS') return false
  if (driver.status === 'ACTIVE') return true
  return !approvalRequired
    && driver.status === 'PENDING_REVIEW'
    && Boolean(driver.selfie?.url && driver.drivingLicense?.url)
}
