using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Social.Api.Migrations
{
    /// <inheritdoc />
    /// <remarks>
    /// Surgical migration: only adds the new tables (comment_reactions, post_shares, post_hashtags).
    /// The managed database is provisioned from template-database/connectly-social-db.sql (snake_case),
    /// so this migration intentionally avoids any rename/diff noise against the legacy Initial snapshot.
    /// </remarks>
    public partial class AddReactionsSharesHashtags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "social");

            migrationBuilder.CreateTable(
                name: "comment_reactions",
                schema: "social",
                columns: table => new
                {
                    comment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reaction_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comment_reactions", x => new { x.comment_id, x.user_id });
                });

            migrationBuilder.CreateTable(
                name: "post_hashtags",
                schema: "social",
                columns: table => new
                {
                    post_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tag = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_post_hashtags", x => new { x.post_id, x.tag });
                });

            migrationBuilder.CreateTable(
                name: "post_shares",
                schema: "social",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    post_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_post_shares", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_comment_reactions_comment_id_reaction_type",
                schema: "social",
                table: "comment_reactions",
                columns: new[] { "comment_id", "reaction_type" });

            migrationBuilder.CreateIndex(
                name: "IX_post_hashtags_tag",
                schema: "social",
                table: "post_hashtags",
                column: "tag");

            migrationBuilder.CreateIndex(
                name: "IX_post_shares_post_id_created_at",
                schema: "social",
                table: "post_shares",
                columns: new[] { "post_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_post_shares_user_id_created_at",
                schema: "social",
                table: "post_shares",
                columns: new[] { "user_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "comment_reactions",
                schema: "social");

            migrationBuilder.DropTable(
                name: "post_hashtags",
                schema: "social");

            migrationBuilder.DropTable(
                name: "post_shares",
                schema: "social");
        }
    }
}
