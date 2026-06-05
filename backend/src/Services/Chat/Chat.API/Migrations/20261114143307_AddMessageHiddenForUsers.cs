using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Chat.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageHiddenForUsers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "message_hidden_for_users",
                schema: "chat",
                columns: table => new
                {
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hidden_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message_hidden_for_users", x => new { x.message_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_message_hidden_for_users_messages_message_id",
                        column: x => x.message_id,
                        principalSchema: "chat",
                        principalTable: "messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_message_hidden_for_users_user_id",
                schema: "chat",
                table: "message_hidden_for_users",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "message_hidden_for_users",
                schema: "chat");
        }
    }
}
