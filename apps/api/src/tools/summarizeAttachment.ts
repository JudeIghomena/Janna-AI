import { z } from "zod";
import { prisma } from "../db/client";
import { getS3Object } from "../lib/s3";

export const summarizeAttachmentSchema = z.object({
  attachmentId: z.string().cuid().describe("The ID of the attachment to summarize"),
});

export type SummarizeAttachmentInput = z.infer<typeof summarizeAttachmentSchema>;

export async function runSummarizeAttachment(
  input: SummarizeAttachmentInput,
  userId: string
): Promise<unknown> {
  const attachment = await prisma.attachment.findFirst({
    where: { id: input.attachmentId, userId },
    include: { chunks: { take: 20, orderBy: { chunkIndex: "asc" } } },
  });

  if (!attachment) {
    throw new Error("Attachment not found or access denied");
  }

  if (attachment.status !== "READY") {
    return { status: "not_ready", message: "Attachment is still being processed" };
  }

  const content = attachment.chunks.map((c) => c.content).join("\n\n");

  return {
    attachmentId: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    chunksLoaded: attachment.chunks.length,
    excerpt: content.slice(0, 2000),
    message: "Use the excerpt above to answer questions about this document.",
  };
}

export const summarizeAttachmentDefinition = {
  name: "summarize_attachment",
  description:
    "Retrieves an excerpt from a specific uploaded attachment by its ID. Use this when the user asks about a specific file.",
  parameters: {
    type: "object",
    properties: {
      attachmentId: {
        type: "string",
        description: "The ID of the attachment",
      },
    },
    required: ["attachmentId"],
  },
};
