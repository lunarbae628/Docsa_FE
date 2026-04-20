import {
  ImageToolTune as BaseImageToolTune,
  type ImageToolTuneData,
} from "editorjs-image-resize-crop"

type ResizeTuneInternal = {
  data: Partial<ImageToolTuneData>
}

function getInternal(instance: ResizeOnlyImageTune) {
  return instance as unknown as ResizeTuneInternal
}

function stripCropData(data: Partial<ImageToolTuneData>) {
  data.crop = false
  data.cropperFrameHeight = 0
  data.cropperFrameWidth = 0
  data.cropperFrameLeft = 0
  data.cropperFrameTop = 0
  data.cropperImageHeight = 0
  data.cropperImageWidth = 0
  data.cropperInterface = undefined
}

function stripCropUi(root: HTMLElement) {
  root.querySelector('[data-tune="crop"]')?.remove()
  for (const element of root.querySelectorAll(".btn-crop-action")) {
    element.remove()
  }
}

export class ResizeOnlyImageTune extends BaseImageToolTune {
  setTune(tune: string): void {
    if (tune === "crop") {
      stripCropData(getInternal(this).data)
      return
    }

    stripCropData(getInternal(this).data)
    super.setTune(tune)
    stripCropData(getInternal(this).data)
  }

  apply(blockContent: HTMLElement): void {
    stripCropData(getInternal(this).data)
    super.apply(blockContent)
    blockContent.classList.remove(this.CSS.isCrop)
    stripCropUi(blockContent)
  }

  render(): HTMLElement {
    const view = super.render()
    stripCropUi(view)
    return view
  }

  save(): ImageToolTuneData {
    const data = super.save()
    stripCropData(data)
    return data
  }
}
