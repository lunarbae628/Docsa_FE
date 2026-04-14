import DocumentCompareView from "@/components/DocumentCompareView"
import DocumentMergeView from "@/components/DocumentMergeView"
import type { OutputData } from "@editorjs/editorjs"
import { useState } from "react"

const baseFixture: OutputData = {
  time: 1713070800000,
  version: "2.30.8",
  blocks: [
    {
      id: "base-heading",
      type: "header",
      data: {
        text: "Docsa 미리보기 기준 문서",
        level: 2,
      },
    },
    {
      id: "base-paragraph",
      type: "paragraph",
      data: {
        text: "Editor.js 프리뷰는 비교와 병합 화면에서 같은 블록처럼 보여야 합니다.",
      },
    },
    {
      id: "base-unordered",
      type: "list",
      data: {
        style: "unordered",
        items: [
          {
            content: "문단 diff 위치를 정확히 표시합니다.",
            meta: {},
            items: [],
          },
          {
            content: "리스트 마커는 흔들리지 않아야 합니다.",
            meta: {},
            items: [],
          },
          {
            content: "중첩 항목도 같은 간격으로 확인합니다.",
            meta: {},
            items: [],
          },
        ],
      },
    },
    {
      id: "base-ordered",
      type: "list",
      data: {
        style: "ordered",
        items: [
          { content: "좌우 문서를 불러옵니다.", meta: {}, items: [] },
          { content: "변경된 문장을 비교합니다.", meta: {}, items: [] },
          {
            content: "선택한 차이를 병합 결과에 반영합니다.",
            meta: {},
            items: [],
          },
        ],
      },
    },
    {
      id: "base-checklist",
      type: "list",
      data: {
        style: "checklist",
        items: [
          {
            content: "체크된 항목은 checked 상태를 유지합니다.",
            meta: { checked: true },
            items: [],
          },
          {
            content: "체크되지 않은 항목도 텍스트 diff를 보여줍니다.",
            meta: { checked: false },
            items: [],
          },
        ],
      },
    },
    {
      id: "base-quote",
      type: "quote",
      data: {
        text: "프리뷰는 입력 가능하지 않아도 사용자가 블록 종류를 바로 식별할 수 있어야 합니다.",
        caption: "미리보기 기준",
        alignment: "left",
      },
    },
    {
      id: "base-code",
      type: "code",
      data: {
        code: "function renderPreview(block) {\n  return renderer.render(block.data)\n}",
      },
    },
    {
      id: "base-delimiter",
      type: "delimiter",
      data: {},
    },
    {
      id: "base-markdown-delimiter",
      type: "paragraph",
      data: {
        text: "***",
      },
    },
    {
      id: "base-tail",
      type: "paragraph",
      data: {
        text: "마지막 문단은 delimiter 아래에서 자연스럽게 이어져야 합니다.",
      },
    },
  ],
}

const targetFixture: OutputData = {
  time: 1713070900000,
  version: "2.30.8",
  blocks: [
    {
      id: "target-heading",
      type: "header",
      data: {
        text: "Docsa 프리뷰 기준 문서",
        level: 2,
      },
    },
    {
      id: "target-paragraph",
      type: "paragraph",
      data: {
        text: "Editor.js 프리뷰는 비교와 병합 화면에서 실제 에디터와 같은 블록처럼 보여야 합니다.",
      },
    },
    {
      id: "target-unordered",
      type: "list",
      data: {
        style: "unordered",
        items: [
          {
            content: "문단 diff 위치를 정확하게 표시합니다.",
            meta: {},
            items: [],
          },
          {
            content: "리스트 마커는 어떤 화면에서도 흔들리지 않아야 합니다.",
            meta: {},
            items: [],
          },
          {
            content: "중첩 항목도 같은 간격으로 검증합니다.",
            meta: {},
            items: [],
          },
        ],
      },
    },
    {
      id: "target-ordered",
      type: "list",
      data: {
        style: "ordered",
        items: [
          { content: "좌우 문서를 불러옵니다.", meta: {}, items: [] },
          { content: "변경된 문구를 비교합니다.", meta: {}, items: [] },
          {
            content: "선택한 차이를 병합 결과에 즉시 반영합니다.",
            meta: {},
            items: [],
          },
        ],
      },
    },
    {
      id: "target-checklist",
      type: "list",
      data: {
        style: "checklist",
        items: [
          {
            content: "체크된 항목은 checked 상태를 그대로 유지합니다.",
            meta: { checked: true },
            items: [],
          },
          {
            content:
              "체크되지 않은 항목도 텍스트 diff를 안정적으로 보여줍니다.",
            meta: { checked: false },
            items: [],
          },
        ],
      },
    },
    {
      id: "target-quote",
      type: "quote",
      data: {
        text: "프리뷰는 입력 가능하지 않아도 사용자가 블록 종류와 변경 위치를 바로 식별할 수 있어야 합니다.",
        caption: "변경된 미리보기 기준",
        alignment: "left",
      },
    },
    {
      id: "target-code",
      type: "code",
      data: {
        code: "function renderPreview(block) {\n  return renderer.renderWithDiff(block.data)\n}",
      },
    },
    {
      id: "target-delimiter",
      type: "delimiter",
      data: {},
    },
    {
      id: "target-markdown-delimiter",
      type: "paragraph",
      data: {
        text: "* * *",
      },
    },
    {
      id: "target-tail",
      type: "paragraph",
      data: {
        text: "마지막 문단은 delimiter 아래에서 자연스럽게 이어져야 합니다.",
      },
    },
  ],
}

export default function PreviewFixturePage() {
  const [savedMerge, setSavedMerge] = useState<OutputData | null>(null)

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6 text-slate-900">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Preview Fixture
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
            Editor.js 비교/병합 프리뷰 점검
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            모든 주요 블록과 diff 케이스를 고정 데이터로 확인합니다. API,
            로그인, 그래프 상태와 무관하게 preview renderer만 점검하는
            화면입니다.
          </p>
          {savedMerge ? (
            <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              마지막 병합 결과: {savedMerge.blocks.length}개 블록
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em]">
              비교 프리뷰
            </h2>
            <p className="text-sm text-slate-500">
              좌우 read-only 프리뷰가 같은 renderer를 타는지 확인합니다.
            </p>
          </div>
          <div className="h-[760px]">
            <DocumentCompareView
              leftData={baseFixture}
              rightData={targetFixture}
              leftLabel="기준 문서"
              leftSubtitle="fixture/base"
              rightLabel="변경 문서"
              rightSubtitle="fixture/target"
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em]">
              병합 프리뷰
            </h2>
            <p className="text-sm text-slate-500">
              좌우 선택, 중앙 병합 결과 반영, delimiter/list 렌더링을 함께
              확인합니다.
            </p>
          </div>
          <div className="h-[1120px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <DocumentMergeView
              baseData={baseFixture}
              targetData={targetFixture}
              title="fixture 병합"
              baseLabel="기준 문서"
              targetLabel="변경 문서"
              onSave={setSavedMerge}
              onCancel={() => setSavedMerge(null)}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
