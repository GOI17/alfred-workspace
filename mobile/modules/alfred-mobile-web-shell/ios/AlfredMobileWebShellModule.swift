import ExpoModulesCore

public class AlfredMobileWebShellModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AlfredMobileWebShell")

    View(AlfredMobileWebShellView.self) {
      Events("onLoadState", "onBridgeMessage")

      Prop("generationDirectory") { (view: AlfredMobileWebShellView, value: String) in
        view.setGenerationDirectory(value)
      }

      Prop("sessionId") { (view: AlfredMobileWebShellView, value: String) in
        view.setSessionId(value)
      }

      Prop("bridgeEnabled") { (view: AlfredMobileWebShellView, value: Bool) in
        view.setBridgeEnabled(value)
      }

      AsyncFunction("postBridgeMessage") {
        (view: AlfredMobileWebShellView, json: String, promise: Promise) in
        try view.postBridgeMessage(json, promise: promise)
      }

      OnViewDidUpdateProps { (view: AlfredMobileWebShellView) in
        view.propsDidUpdate()
      }
    }
  }
}
