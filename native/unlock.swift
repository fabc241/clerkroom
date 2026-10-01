// Asks macOS to confirm the Mac's owner (Touch ID, or the login password as a fallback) before
// Clerkroom unlocks. Built by `npm run build:unlock`; the app runs it and only reads the exit code.
//
//   Clerkroom --check      exit 0 if this Mac can authenticate its owner, 2 if it cannot
//   Clerkroom "<reason>"   exit 0 once authenticated, 1 if cancelled or failed, 2 if unavailable
//
// macOS shows the reason as "Clerkroom is trying to <reason>."
import Foundation
import LocalAuthentication

let args = Array(CommandLine.arguments.dropFirst())
let context = LAContext()
var error: NSError?

guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else { exit(2) }
if args.first == "--check" { exit(0) }

context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: args.first ?? "unlock Clerkroom") { ok, _ in
  exit(ok ? 0 : 1)
}
dispatchMain()
