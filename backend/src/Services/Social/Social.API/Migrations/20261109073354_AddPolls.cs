using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Social.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPolls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "poll_options",
                schema: "social",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    post_id = table.Column<Guid>(type: "uuid", nullable: false),
                    text = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_poll_options", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "poll_votes",
                schema: "social",
                columns: table => new
                {
                    post_id = table.Column<Guid>(type: "uuid", nullable: false),
                    option_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_poll_votes", x => new { x.post_id, x.option_id, x.user_id });
                });

            migrationBuilder.CreateTable(
                name: "polls",
                schema: "social",
                columns: table => new
                {
                    post_id = table.Column<Guid>(type: "uuid", nullable: false),
                    question = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    allow_multiple = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_polls", x => x.post_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_poll_options_post_id_sort_order",
                schema: "social",
                table: "poll_options",
                columns: new[] { "post_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "IX_poll_votes_post_id_user_id",
                schema: "social",
                table: "poll_votes",
                columns: new[] { "post_id", "user_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "poll_options",
                schema: "social");

            migrationBuilder.DropTable(
                name: "poll_votes",
                schema: "social");

            migrationBuilder.DropTable(
                name: "polls",
                schema: "social");
        }
    }
}
