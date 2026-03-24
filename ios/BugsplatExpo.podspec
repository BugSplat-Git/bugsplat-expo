require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'BugsplatExpo'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/BugSplat-Git/bugsplat-expo.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "*.{h,m,mm,swift,hpp,cpp}"
  s.vendored_frameworks = 'Frameworks/BugSplat.xcframework'
  s.libraries = 'z', 'c++'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.prepare_command = <<-CMD
    mkdir -p Frameworks
    if [ ! -d "Frameworks/BugSplat.xcframework" ]; then
      curl -sL -o BugSplat.xcframework.zip "https://github.com/BugSplat-Git/bugsplat-apple/releases/download/v3.0.0/BugSplat.xcframework.zip"
      unzip -o BugSplat.xcframework.zip -d Frameworks
      rm -f BugSplat.xcframework.zip
    fi
  CMD
end
