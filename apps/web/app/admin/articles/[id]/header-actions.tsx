"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Archive,
  Copy,
  Trash2,
  MoreHorizontal,
  ExternalLink
} from "lucide-react";
import {
  AdminButton,
  AdminLinkButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  useConfirm
} from "../../../../components/admin/ui";
import type { ArticleStatus } from "../../../../lib/types";
import {
  archiveArticleAction,
  deleteArticleAction,
  duplicateArticleAction,
  publishArticleAction
} from "../../actions";

interface HeaderActionsProps {
  articleId: string;
  slug: string;
  title: string;
  status: ArticleStatus;
}

export function ArticleHeaderActions({
  articleId,
  slug,
  title,
  status
}: HeaderActionsProps): React.ReactElement {
  const router = useRouter();
  const confirm = useConfirm();

  const callAction = async (
    action:
      | typeof publishArticleAction
      | typeof archiveArticleAction
      | typeof duplicateArticleAction
      | typeof deleteArticleAction,
    needsReviewer = false
  ) => {
    const fd = new FormData();
    fd.set("id", articleId);
    if (needsReviewer) fd.set("reviewer", "admin");
    await action(fd);
    router.refresh();
  };

  const handlePublish = () => callAction(publishArticleAction, true);
  const handleArchive = () => callAction(archiveArticleAction, true);
  const handleDuplicate = () => callAction(duplicateArticleAction);
  const handleDelete = async () => {
    const ok = await confirm({
      title: "Xoá bài viết?",
      message: `Xoá vĩnh viễn "${title}"? Không thể hoàn tác.`,
      tone: "danger",
      confirmLabel: "Xoá"
    });
    if (!ok) return;
    await callAction(deleteArticleAction);
    router.push("/admin/articles");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "PUBLISHED" && status !== "GENERATING" ? (
        <AdminButton size="md" iconLeft={<CheckCircle2 />} onClick={handlePublish}>
          Đăng bài
        </AdminButton>
      ) : null}
      {status === "PUBLISHED" ? (
        <AdminLinkButton
          href={`/blog/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          size="md"
          iconRight={<ExternalLink />}
        >
          Xem live
        </AdminLinkButton>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <AdminButton variant="outline" size="md" iconLeft={<MoreHorizontal />}>
            Thao tác khác
          </AdminButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status !== "ARCHIVED" && status !== "GENERATING" ? (
            <DropdownMenuItem iconLeft={<Archive />} onSelect={handleArchive}>
              Lưu trữ
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem iconLeft={<Copy />} onSelect={handleDuplicate}>
            Nhân bản
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem iconLeft={<Trash2 />} tone="danger" onSelect={handleDelete}>
            Xoá vĩnh viễn
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
