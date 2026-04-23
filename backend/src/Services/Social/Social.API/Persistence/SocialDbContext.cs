using Social.Domain;
using BuildingBlocks.Messaging;
using Microsoft.EntityFrameworkCore;

namespace Social.Persistence;

public class SocialDbContext(DbContextOptions<SocialDbContext> options) : DbContext(options), IOutboxDbContext
{
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<UserFollow> Follows => Set<UserFollow>();
    public DbSet<UserBlock> Blocks => Set<UserBlock>();
    public DbSet<UserMute> Mutes => Set<UserMute>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<PostMedia> PostMedia => Set<PostMedia>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<PostReaction> PostReactions => Set<PostReaction>();
    public DbSet<PostBookmark> Bookmarks => Set<PostBookmark>();
    public DbSet<CommentReaction> CommentReactions => Set<CommentReaction>();
    public DbSet<PostShare> Shares => Set<PostShare>();
    public DbSet<PostHashtag> PostHashtags => Set<PostHashtag>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<EventAttendee> EventAttendees => Set<EventAttendee>();
    public DbSet<Poll> Polls => Set<Poll>();
    public DbSet<PollOption> PollOptions => Set<PollOption>();
    public DbSet<PollVote> PollVotes => Set<PollVote>();
    public DbSet<Page> Pages => Set<Page>();
    public DbSet<PageAdmin> PageAdmins => Set<PageAdmin>();
    public DbSet<Story> Stories => Set<Story>();
    public DbSet<StoryView> StoryViews => Set<StoryView>();
    public DbSet<Highlight> Highlights => Set<Highlight>();
    public DbSet<HighlightStory> HighlightStories => Set<HighlightStory>();
    public DbSet<PostMention> PostMentions => Set<PostMention>();
    public DbSet<CommentMention> CommentMentions => Set<CommentMention>();
    public DbSet<ReelView> ReelViews => Set<ReelView>();
    public DbSet<PostEdit> PostEdits => Set<PostEdit>();
    public DbSet<CommentEdit> CommentEdits => Set<CommentEdit>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("social");
        modelBuilder.ApplyOutboxModule();

        modelBuilder.Entity<Profile>(b =>
        {
            b.ToTable("profiles");
            b.HasIndex(p => p.UserId).IsUnique();
            b.HasIndex(p => p.Username).IsUnique();
            b.Property(p => p.Id).HasColumnName("id");
            b.Property(p => p.UserId).HasColumnName("user_id");
            b.Property(p => p.DisplayName).HasColumnName("display_name").HasMaxLength(120);
            b.Property(p => p.Username).HasColumnName("username").HasMaxLength(30);
            b.Property(p => p.Bio).HasColumnName("bio");
            b.Property(p => p.AvatarObjectKey).HasColumnName("avatar_object_key");
            b.Property(p => p.CoverObjectKey).HasColumnName("cover_object_key");
            b.Property(p => p.Website).HasColumnName("website");
            b.Property(p => p.LocationText).HasColumnName("location_text");
            b.Property(p => p.ContactEmail).HasColumnName("contact_email").HasMaxLength(200);
            b.Property(p => p.DateOfBirth).HasColumnName("date_of_birth");
            b.Property(p => p.PhoneNumber).HasColumnName("phone_number").HasMaxLength(40);
            b.Property(p => p.City).HasColumnName("city").HasMaxLength(120);
            b.Property(p => p.Hometown).HasColumnName("hometown").HasMaxLength(120);
            b.Property(p => p.DefaultPostVisibility).HasColumnName("default_post_visibility");
            b.Property(p => p.FriendRequestPolicy).HasColumnName("friend_request_policy");
            b.Property(p => p.AvatarAudience).HasColumnName("avatar_audience");
            b.Property(p => p.CoverAudience).HasColumnName("cover_audience");
            b.Property(p => p.BioAudience).HasColumnName("bio_audience");
            b.Property(p => p.WebsiteAudience).HasColumnName("website_audience");
            b.Property(p => p.LocationAudience).HasColumnName("location_audience");
            b.Property(p => p.EmailAudience).HasColumnName("email_audience");
            b.Property(p => p.BirthdayAudience).HasColumnName("birthday_audience");
            b.Property(p => p.PhoneAudience).HasColumnName("phone_audience");
            b.Property(p => p.CityAudience).HasColumnName("city_audience");
            b.Property(p => p.HometownAudience).HasColumnName("hometown_audience");
            b.Property(p => p.FriendListAudience).HasColumnName("friend_list_audience");
            b.Property(p => p.FollowingAudience).HasColumnName("following_audience");
            b.Property(p => p.FollowersAudience).HasColumnName("followers_audience");
            b.Property(p => p.CommentAudience).HasColumnName("comment_audience");
            b.Property(p => p.SearchableAudience).HasColumnName("searchable_audience");
            b.Property(p => p.CreatedAt).HasColumnName("created_at");
            b.Property(p => p.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<Friendship>(b =>
        {
            b.ToTable("friendships");
            b.HasIndex(f => new { f.UserLowId, f.UserHighId }).IsUnique();
            b.HasIndex(f => new { f.UserLowId, f.Status });
            b.HasIndex(f => new { f.UserHighId, f.Status });
            b.ToTable(t => t.HasCheckConstraint("ck_friendship_order", "\"user_low_id\" < \"user_high_id\""));
            b.Property(f => f.Id).HasColumnName("id");
            b.Property(f => f.UserLowId).HasColumnName("user_low_id");
            b.Property(f => f.UserHighId).HasColumnName("user_high_id");
            b.Property(f => f.RequestedByUserId).HasColumnName("requested_by_user_id");
            b.Property(f => f.Status).HasColumnName("status");
            b.Property(f => f.CreatedAt).HasColumnName("created_at");
            b.Property(f => f.RespondedAt).HasColumnName("responded_at");
        });

        modelBuilder.Entity<UserFollow>(b =>
        {
            b.ToTable("user_follows");
            b.HasKey(f => new { f.FollowerId, f.FolloweeId });
            b.HasIndex(f => new { f.FolloweeId, f.CreatedAt });
            b.HasIndex(f => new { f.FollowerId, f.CreatedAt });
            b.Property(f => f.FollowerId).HasColumnName("follower_id");
            b.Property(f => f.FolloweeId).HasColumnName("followee_id");
            b.Property(f => f.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<UserBlock>(b =>
        {
            b.ToTable("user_blocks");
            b.HasKey(x => new { x.BlockerId, x.BlockedUserId });
            b.HasIndex(x => x.BlockedUserId);
            b.Property(x => x.BlockerId).HasColumnName("blocker_id");
            b.Property(x => x.BlockedUserId).HasColumnName("blocked_user_id");
            b.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<UserMute>(b =>
        {
            b.ToTable("user_mutes");
            b.HasKey(x => new { x.MuterId, x.MutedUserId });
            b.Property(x => x.MuterId).HasColumnName("muter_id");
            b.Property(x => x.MutedUserId).HasColumnName("muted_user_id");
            b.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<Post>(b =>
        {
            b.ToTable("posts");
            b.HasIndex(p => new { p.AuthorUserId, p.PublishedAt });
            b.HasIndex(p => new { p.Status, p.PublishedAt });
            b.Property(p => p.Id).HasColumnName("id");
            b.Property(p => p.AuthorUserId).HasColumnName("author_user_id");
            b.Property(p => p.GroupId).HasColumnName("group_id");
            b.Property(p => p.PageId).HasColumnName("page_id");
            b.Property(p => p.TextContent).HasColumnName("text_content").HasMaxLength(5000);
            b.Property(p => p.Visibility).HasColumnName("visibility");
            b.Property(p => p.Status).HasColumnName("status");
            b.Property(p => p.IsReel).HasColumnName("is_reel");
            b.Property(p => p.CreatedAt).HasColumnName("created_at");
            b.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            b.Property(p => p.PublishedAt).HasColumnName("published_at");
            b.Property(p => p.EditedAt).HasColumnName("edited_at");
            b.Property(p => p.DeletedAt).HasColumnName("deleted_at");
            b.HasIndex(p => new { p.GroupId, p.PublishedAt });
            b.HasIndex(p => new { p.PageId, p.PublishedAt });
            b.HasIndex(p => new { p.IsReel, p.PublishedAt });
        });

        modelBuilder.Entity<PostMedia>(b =>
        {
            b.ToTable("post_media");
            b.HasKey(m => m.Id);
            b.HasIndex(m => new { m.PostId, m.SortOrder });
            b.Property(m => m.Id).HasColumnName("id");
            b.Property(m => m.PostId).HasColumnName("post_id");
            b.Property(m => m.ObjectKey).HasColumnName("object_key");
            b.Property(m => m.ContentType).HasColumnName("content_type");
            b.Property(m => m.SizeBytes).HasColumnName("size_bytes");
            b.Property(m => m.SortOrder).HasColumnName("sort_order");
            b.HasOne(m => m.Post).WithMany(p => p.Media).HasForeignKey(m => m.PostId);
        });

        modelBuilder.Entity<MediaAsset>(b =>
        {
            b.ToTable("media_assets");
            b.HasIndex(m => m.Id).IsUnique();
            b.HasIndex(m => new { m.OwnerUserId, m.Status });
            b.Property(m => m.Id).HasColumnName("id");
            b.Property(m => m.OwnerUserId).HasColumnName("owner_user_id");
            b.Property(m => m.ObjectKey).HasColumnName("object_key");
            b.Property(m => m.ContentType).HasColumnName("content_type");
            b.Property(m => m.SizeBytes).HasColumnName("size_bytes");
            b.Property(m => m.Kind).HasColumnName("kind");
            b.Property(m => m.Status).HasColumnName("status");
            b.Property(m => m.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<Comment>(b =>
        {
            b.ToTable("comments");
            b.HasIndex(c => new { c.PostId, c.CreatedAt });
            b.HasIndex(c => c.ParentCommentId);
            b.Property(c => c.Id).HasColumnName("id");
            b.Property(c => c.PostId).HasColumnName("post_id");
            b.Property(c => c.AuthorUserId).HasColumnName("author_user_id");
            b.Property(c => c.ParentCommentId).HasColumnName("parent_comment_id");
            b.Property(c => c.Content).HasColumnName("content");
            b.Property(c => c.Status).HasColumnName("status");
            b.Property(c => c.CreatedAt).HasColumnName("created_at");
            b.Property(c => c.UpdatedAt).HasColumnName("updated_at");
            b.HasOne(c => c.Post).WithMany().HasForeignKey(c => c.PostId);
        });

