Pod::Spec.new do |s|
  s.name = 'AlfredNotificationDismissal'
  s.version = '0.0.1'
  s.summary = 'Native notification dismissal and sequence fencing'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Alfred'
  s.homepage = 'https://alfredlabs.org'
  s.source = { :git => 'https://github.com/GOI17/alfred-workspace.git' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
