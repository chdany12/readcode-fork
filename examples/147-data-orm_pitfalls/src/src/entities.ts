import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, VersionColumn } from "typeorm";

@Entity("topics")
export class Topic {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  slug!: string;

  @Column({ default: false })
  archived!: boolean;
}

@Entity("posts")
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "author_id" })
  authorId!: string;

  @Column("text")
  body!: string;

  @ManyToMany(() => Topic)
  @JoinTable({ name: "post_topics" })
  topics!: Topic[];

  @VersionColumn()
  version!: number;
}
