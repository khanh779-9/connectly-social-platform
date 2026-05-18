using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Connectly.Social.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProfilePrivacySettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "avatar_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "bio_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "birthday_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "city",
                schema: "social",
                table: "profiles",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "city_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "contact_email",
                schema: "social",
                table: "profiles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "cover_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateOnly>(
                name: "date_of_birth",
                schema: "social",
                table: "profiles",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "default_post_visibility",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "email_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "following_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "friend_list_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "friend_request_policy",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "hometown",
                schema: "social",
                table: "profiles",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "hometown_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "location_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "phone_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "phone_number",
                schema: "social",
                table: "profiles",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "website_audience",
                schema: "social",
                table: "profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "avatar_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "bio_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "birthday_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "city",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "city_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "contact_email",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "cover_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "date_of_birth",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "default_post_visibility",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "email_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "following_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "friend_list_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "friend_request_policy",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "hometown",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "hometown_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "location_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "phone_audience",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "phone_number",
                schema: "social",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "website_audience",
                schema: "social",
                table: "profiles");
        }
    }
}
