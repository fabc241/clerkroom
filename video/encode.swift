// Encodes video/build/frames/*.png (30 fps) + video/build/music.m4a into an X-ready MP4:
// H.264 High, 1920x1080, 30 fps, AAC stereo. Uses only macOS frameworks.
//   afconvert -f m4af -d aac -b 256000 video/build/music.wav video/build/music.m4a
//   swift video/encode.swift video/build/frames video/build/music.m4a video/clerkroom-demo.mp4
import AVFoundation
import CoreImage
import Foundation
import ImageIO

let args = CommandLine.arguments
let framesDir = URL(fileURLWithPath: args[1])
let audioURL = URL(fileURLWithPath: args[2])
let outURL = URL(fileURLWithPath: args[3])
let silentURL = outURL.deletingPathExtension().appendingPathExtension("video-only.mp4")
let fps: Int32 = 30
let width = 1920
let height = 1080

func fail(_ msg: String) -> Never {
    FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
    exit(1)
}

// 1. Frames -> H.264.
let frames = try FileManager.default.contentsOfDirectory(atPath: framesDir.path).filter { $0.hasSuffix(".png") }.sorted()
try? FileManager.default.removeItem(at: silentURL)
let writer = try AVAssetWriter(outputURL: silentURL, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
    ],
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 14_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: 30,
        AVVideoAllowFrameReorderingKey: true,
    ],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!

for (i, name) in frames.enumerated() {
    autoreleasepool {
        let url = framesDir.appendingPathComponent(name)
        guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fail("Cannot read \(name)") }
        while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
        var pb: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
        guard let buffer = pb else { fail("No pixel buffer") }
        CVPixelBufferLockBaseAddress(buffer, [])
        let ctx = CGContext(
            data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height, bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: srgb,
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        CVPixelBufferUnlockBaseAddress(buffer, [])
        adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
    }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed { fail("Video write failed: \(String(describing: writer.error))") }
print("video: \(frames.count) frames")

// 2. Mux with the soundtrack (passthrough: no re-encode).
let comp = AVMutableComposition()
let video = AVURLAsset(url: silentURL)
let audio = AVURLAsset(url: audioURL)
let duration = CMTime(value: CMTimeValue(frames.count), timescale: fps)
let sema = DispatchSemaphore(value: 0)
Task {
    do {
        let vTrack = try await video.loadTracks(withMediaType: .video)[0]
        let aTrack = try await audio.loadTracks(withMediaType: .audio)[0]
        let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
        try cv.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: vTrack, at: .zero)
        let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
        let aDur = try await audio.load(.duration)
        try ca.insertTimeRange(CMTimeRange(start: .zero, duration: CMTimeMinimum(aDur, duration)), of: aTrack, at: .zero)
        try? FileManager.default.removeItem(at: outURL)
        let export = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough)!
        try await export.export(to: outURL, as: .mp4)
        try? FileManager.default.removeItem(at: silentURL)
        print("wrote \(outURL.path)")
    } catch {
        fail("Mux failed: \(error)")
    }
    sema.signal()
}
sema.wait()
