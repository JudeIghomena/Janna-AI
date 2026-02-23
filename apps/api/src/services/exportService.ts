import { prisma } from "../db/client";

export async function exportConversationMarkdown(
  conversationId: string,
  userId: string
): Promise<string> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) throw new Error("Conversation not found");

  const lines: string[] = [
    `# ${conversation.title}`,
    ``,
    `_Exported from Janna AI on ${new Date().toISOString()}_`,
    ``,
    `---`,
    ``,
  ];

  for (const msg of conversation.messages) {
    const header =
      msg.role === "user"
        ? `## You`
        : msg.role === "assistant"
        ? `## Janna AI`
        : `## [${msg.role}]`;

    lines.push(header);
    lines.push(``);
    lines.push(msg.content);
    lines.push(``);
    lines.push(
      `_${new Date(msg.createdAt).toLocaleString()}_`
    );
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }

  return lines.join("\n");
}
