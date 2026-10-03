package expo.modules.alfredmobilewebshell

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AlfredMobileWebShellModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AlfredMobileWebShell")

    View(AlfredMobileWebShellView::class) {
      Events("onLoadState", "onBridgeMessage")

      Prop("generationDirectory") { view: AlfredMobileWebShellView, value: String ->
        view.setGenerationDirectory(value)
      }

      Prop("sessionId") { view: AlfredMobileWebShellView, value: String ->
        view.setSessionId(value)
      }

      Prop("bridgeEnabled") { view: AlfredMobileWebShellView, value: Boolean ->
        view.setBridgeEnabled(value)
      }

      AsyncFunction("postBridgeMessage") { view: AlfredMobileWebShellView, json: String ->
        view.postBridgeMessage(json)
      }

      OnViewDidUpdateProps { view: AlfredMobileWebShellView ->
        view.propsDidUpdate()
      }

      OnViewDestroys { view: AlfredMobileWebShellView ->
        view.destroyWebView()
      }
    }
  }
}
