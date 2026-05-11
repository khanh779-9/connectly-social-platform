using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Social.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupsAndEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "group_id",
                schema: "social",
                table: "posts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "event_attendees",
                schema: "social",
                columns: table => new
                {
                    event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rsvp = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_attendees", x => new { x.event_id, x.user_id });
                });

            migrationBuilder.CreateTable(
                name: "events",
                schema: "social",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    description = table.Column<string>(type: "character varying(5000)", maxLength: 5000, nullable: true),
                    location_text = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: true),
                    online_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ends_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    host_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    group_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "group_members",
                schema: "social",
                columns: table => new
                {
                    group_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    joined_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_group_members", x => new { x.group_id, x.user_id });
                });

            migrationBuilder.CreateTable(
                name: "groups",
                schema: "social",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    visibility = table.Column<int>(type: "integer", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_groups", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_posts_group_id_published_at",
                schema: "social",
                table: "posts",
                columns: new[] { "group_id", "published_at" });

            migrationBuilder.CreateIndex(
                name: "IX_event_attendees_user_id_rsvp",
                schema: "social",
                table: "event_attendees",
                columns: new[] { "user_id", "rsvp" });

            migrationBuilder.CreateIndex(
                name: "IX_events_group_id_starts_at",
                schema: "social",
                table: "events",
                columns: new[] { "group_id", "starts_at" });

            migrationBuilder.CreateIndex(
                name: "IX_events_host_user_id_starts_at",
                schema: "social",
                table: "events",
                columns: new[] { "host_user_id", "starts_at" });

            migrationBuilder.CreateIndex(
                name: "IX_events_starts_at",
                schema: "social",
                table: "events",
                column: "starts_at");

            migrationBuilder.CreateIndex(
                name: "IX_group_members_group_id_status",
                schema: "social",
                table: "group_members",
                columns: new[] { "group_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_group_members_user_id_status",
                schema: "social",
                table: "group_members",
                columns: new[] { "user_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_groups_created_by_user_id",
                schema: "social",
                table: "groups",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_groups_visibility_created_at",
                schema: "social",
                table: "groups",
                columns: new[] { "visibility", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_attendees",
                schema: "social");

            migrationBuilder.DropTable(
                name: "events",
                schema: "social");

            migrationBuilder.DropTable(
                name: "group_members",
                schema: "social");

            migrationBuilder.DropTable(
                name: "groups",
                schema: "social");

            migrationBuilder.DropIndex(
                name: "IX_posts_group_id_published_at",
                schema: "social",
                table: "posts");

            migrationBuilder.DropColumn(
                name: "group_id",
                schema: "social",
                table: "posts");
        }
    }
}
