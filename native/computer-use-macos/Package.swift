// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "AlfredComputerUseMacOS",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "AlfredComputerUseMacOSCore",
            targets: ["AlfredComputerUseMacOSCore"]
        ),
        .executable(
            name: "alfred-computer-use-macos",
            targets: ["AlfredComputerUseMacOS"]
        )
    ],
    targets: [
        .target(
            name: "AlfredComputerUseMacOSCore",
            path: "Sources/AlfredComputerUseMacOSCore"
        ),
        .executableTarget(
            name: "AlfredComputerUseMacOS",
            dependencies: ["AlfredComputerUseMacOSCore"],
            path: "Sources/AlfredComputerUseMacOS"
        ),
        .testTarget(
            name: "AlfredComputerUseMacOSTests",
            dependencies: ["AlfredComputerUseMacOSCore"],
            path: "Tests/AlfredComputerUseMacOSTests"
        )
    ]
)
