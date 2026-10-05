import type { Metadata } from "next";
import { Workspace } from "@/shared/components/workspace";
import { Shell } from "@/shared/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Lakehouse · Operations Lab", template: "%s · Lakehouse" },
  description:
    "서비스 로그와 Lakehouse 지표를 탐색하는 데이터 엔지니어링 학습 대시보드",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Workspace>
          <Shell>{children}</Shell>
        </Workspace>
      </body>
    </html>
  );
}
