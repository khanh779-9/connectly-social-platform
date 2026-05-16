using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Social.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMentions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "username",
                schema: "social",
                table: "profiles",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            // backfill a unique @handle for every profile created before this
            // migration (slug of the display name, suffixed when duplicated)
            migrationBuilder.Sql("""
                WITH base AS (
                    SELECT id,
                           user_id,
                           created_at,
                           LOWER(TRIM(BOTH '_' FROM REGEXP_REPLACE(display_name, '[^a-zA-Z0-9]+', '_', 'g'))) AS slug
                    FROM social.profiles
                    WHERE username IS NULL
                ),
                numbered AS (
                    SELECT id,
                           user_id,
                           CASE
                               WHEN LENGTH(slug) BETWEEN 3 AND 30 THEN slug
                               ELSE 'user_' || SUBSTRING(REPLACE(user_id::text, '-', '') FROM 1 FOR 8)
                           END AS base_slug,
                           ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
                    FROM base
                )
                UPDATE social.profiles p
                SET username = LEFT(
                    CASE
                        WHEN n.rn = 1 THEN n.base_slug
                        ELSE LEFT(n.base_slug, 30 - LENGTH(n.rn::text) - 1) || '_' || n.rn::text
                    END, 30)
                FROM numbered n
                WHERE p.id = n.id AND p.username IS NULL;
                """);

            migrationBuilder.CreateTable(
                name: "comment_mentions",
                schema: "social",
                columns: table => new
                {
                    comment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comment_mentions", x => new { x.comment_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_comment_mentions_comments_comment_id",
                        column: x => x.comment_id,
                        principalSchema: "social",
                        principalTable: "comments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "post_mentions",
                schema: "social",
                columns: table => new
                {
                    post_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_post_mentions", x => new { x.post_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_post_mentions_posts_post_id",
                        column: x => x.post_id,
                        principalSchema: "social",
                        principalTable: "posts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_profiles_username",
                schema: "social",
                table: "profiles",
                column: "username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_comment_mentions_user_id",
                schema: "social",
                table: "comment_mentions",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_post_mentions_user_id",
                schema: "social",
                table: "post_mentions",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "comment_mentions",
                schema: "social");

            migrationBuilder.DropTable(
                name: "post_mentions",
                schema: "social");

            migrationBuilder.DropIndex(
                name: "IX_profiles_username",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "username",
                schema: "social",
                table: "profiles");
        }
    }
}
