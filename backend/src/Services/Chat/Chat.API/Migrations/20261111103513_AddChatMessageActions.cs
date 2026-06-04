using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Chat.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddChatMessageActions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Reply/quote: self reference to the quoted message.
            migrationBuilder.AddColumn<Guid>(
                name: "reply_to_message_id",
                schema: "chat",
                table: "messages",
                type: "uuid",
                nullable: true);

            // Emoji reactions on messages (one row per user + emoji + message).
            migrationBuilder.CreateTable(
                name: "message_reactions",
                schema: "chat",
                columns: table => new
                {
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reaction_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message_reactions", x => new { x.message_id, x.user_id, x.reaction_type });
                    table.ForeignKey(
                        name: "FK_message_reactions_messages_message_id",
                        column: x => x.message_id,
                        principalSchema: "chat",
                        principalTable: "messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_messages_reply_to_message_id",
                schema: "chat",
                table: "messages",
                column: "reply_to_message_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_reactions_message_id",
                schema: "chat",
                table: "message_reactions",
                column: "message_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_reactions_user_id",
                schema: "chat",
                table: "message_reactions",
                column: "user_id");

            // Deleting the quoted message keeps the reply but drops the quote link.
            migrationBuilder.AddForeignKey(
                name: "FK_messages_messages_reply_to_message_id",
                schema: "chat",
                table: "messages",
                column: "reply_to_message_id",
                principalSchema: "chat",
                principalTable: "messages",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_messages_messages_reply_to_message_id",
                schema: "chat",
                table: "messages");

            migrationBuilder.DropTable(
                name: "message_reactions",
                schema: "chat");

            migrationBuilder.DropIndex(
                name: "IX_messages_reply_to_message_id",
                schema: "chat",
                table: "messages");

            migrationBuilder.DropColumn(
                name: "reply_to_message_id",
                schema: "chat",
                table: "messages");
        }
    }
}
