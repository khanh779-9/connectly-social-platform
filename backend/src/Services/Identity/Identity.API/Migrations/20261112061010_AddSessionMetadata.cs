using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSessionMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "device_id",
                schema: "identity",
                table: "refresh_tokens",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "device_label",
                schema: "identity",
                table: "refresh_tokens",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ip_address",
                schema: "identity",
                table: "refresh_tokens",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "last_used_at",
                schema: "identity",
                table: "refresh_tokens",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "location",
                schema: "identity",
                table: "refresh_tokens",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "user_agent",
                schema: "identity",
                table: "refresh_tokens",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_user_id_device_id",
                schema: "identity",
                table: "refresh_tokens",
                columns: new[] { "user_id", "device_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_refresh_tokens_user_id_device_id",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "device_id",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "device_label",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "ip_address",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "last_used_at",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "location",
                schema: "identity",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "user_agent",
                schema: "identity",
                table: "refresh_tokens");
        }
    }
}
