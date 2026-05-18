using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Social.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_reel",
                schema: "social",
                table: "posts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "reel_views",
                schema: "social",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    post_id = table.Column<Guid>(type: "uuid", nullable: false),
                    viewer_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    watched_ms = table.Column<int>(type: "integer", nullable: false),
                    viewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reel_views", x => x.id);
                    table.ForeignKey(
                        name: "FK_reel_views_posts_post_id",
                        column: x => x.post_id,
                        principalSchema: "social",
                        principalTable: "posts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_posts_is_reel_published_at",
                schema: "social",
                table: "posts",
                columns: new[] { "is_reel", "published_at" });

            migrationBuilder.CreateIndex(
                name: "IX_reel_views_post_id_viewed_at",
                schema: "social",
                table: "reel_views",
                columns: new[] { "post_id", "viewed_at" });

            migrationBuilder.CreateIndex(
                name: "IX_reel_views_viewer_user_id_viewed_at",
                schema: "social",
                table: "reel_views",
                columns: new[] { "viewer_user_id", "viewed_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reel_views",
                schema: "social");

            migrationBuilder.DropIndex(
                name: "IX_posts_is_reel_published_at",
                schema: "social",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "is_reel",
                schema: "social",
                table: "posts");
        }
    }
}
