using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Social.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "page_id",
                schema: "social",
                table: "posts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "page_admins",
                schema: "social",
                columns: table => new
                {
                    page_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<int>(type: "integer", nullable: false),
                    added_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_page_admins", x => new { x.page_id, x.user_id });
                });

            migrationBuilder.CreateTable(
                name: "pages",
                schema: "social",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    avatar_object_key = table.Column<string>(type: "text", nullable: true),
                    cover_object_key = table.Column<string>(type: "text", nullable: true),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pages", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_posts_page_id_published_at",
                schema: "social",
                table: "posts",
                columns: new[] { "page_id", "published_at" });

            migrationBuilder.CreateIndex(
                name: "IX_page_admins_user_id",
                schema: "social",
                table: "page_admins",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_pages_name",
                schema: "social",
                table: "pages",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "IX_pages_owner_user_id",
                schema: "social",
                table: "pages",
                column: "owner_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "page_admins",
                schema: "social");

            migrationBuilder.DropTable(
                name: "pages",
                schema: "social");

            migrationBuilder.DropIndex(
                name: "IX_posts_page_id_published_at",
                schema: "social",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "page_id",
                schema: "social",
                table: "posts");
        }
    }
}
