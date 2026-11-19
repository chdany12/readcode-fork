import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  email!: string;
}

@Entity("devices")
export class Device {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ name: "install_id" })
  installId!: string;

  @Column({ name: "push_token" })
  pushToken!: string;

  @Column({ name: "platform" })
  platform!: "ios" | "android";

  @ManyToOne(() => User, { onDelete: "CASCADE", eager: false })
  user!: User;

  @Column({ name: "user_id" })
  userId!: string;

  @Column({ name: "disabled_at", type: "timestamptz", nullable: true })
  disabledAt!: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
