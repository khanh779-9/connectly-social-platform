using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Social.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddContentEditHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "comment_edits",
                schema: "social",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    comment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    editor_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    previous_content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    new_content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    edited_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comment_edits", x => x.id);
                    table.ForeignKey(
                        name: "FK_comment_edits_comments_comment_id",
                        column: x => x.comment_id,
                        principalSchema: "social",
                        principalTable: "comments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "post_edits",
                schema: "social",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    post_id = table.Column<Guid>(type: "uuid", nullable: false),
                    editor_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    previous_text = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: true),
                    new_text = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: true),
                    edited_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_post_edits", x => x.id);
                    table.ForeignKey(
                        name: "FK_post_edits_posts_post_id",
                        column: x => x.post_id,
                        principalSchema: "social",
                        principalTable: "posts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_comment_edits_comment_id_edited_at",
                schema: "social",
                table: "comment_edits",
                columns: new[] { "comment_id", "edited_at" });

            migrationBuilder.CreateIndex(
                name: "IX_post_edits_post_id_edited_at",
                schema: "social",
                table: "post_edits",
                columns: new[] { "post_id", "edited_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "comment_edits",
                schema: "social");

            migrationBuilder.DropTable(
                name: "post_edits",
                schema: "social");
        }
    }
}
