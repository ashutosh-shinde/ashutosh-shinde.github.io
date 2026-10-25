---
title: What is infinity?
date: 2021-08-21
category: Set theory
abstract: How big are infinities? Why are some infinities bigger than others? Are there more real numbers than natural numbers? How can a plane and a line have the same number of points on them? We will look for answers to these questions and dive into the ocean of infinitely many different infinities.
---

## Introduction

What is the biggest number that you can think of? A billion? A trillion? A billion billion trillion decillion? No matter how big a number you can think of, you can always go higher. So there is no biggest number! Except infinity?! Is infinity a number? Well, infinity is not a number. Then what is infinity? We all kind of have a concept of infinity: something that goes on forever and ever and ever, something unending. Whatever number you think of, you can always add one more to it. Hence there are infinitely many numbers.

There are infinitely many points on a line. There are also infinitely many points on a plane. But are there as many points on a line as on a plane? And are there more natural numbers than even numbers? Natural numbers are the numbers $1, 2, 3, 4, 5, \ldots$ Even numbers are the natural numbers that are multiples of 2, and the rest are the odd numbers. Now one may think: there are infinitely many natural numbers, and infinitely many even numbers too, so the two should be equal! On the other hand, one may think: the even numbers are only a part of the natural numbers, and all the odd numbers are left over, so there have got to be more natural numbers than even numbers.

We can see the “problem” with infinity: an infinite collection can have as many elements as a part of itself. So how do we compare infinities? Can we compare infinities at all? Imagine you are the manager of a hotel with infinitely many rooms. All the rooms are occupied, and a new guest arrives. Can you give him a room? Yes, you can. You just move the guest in room 1 to room 2, the guest in room 2 to room 3, and so on. Room 1 is now free for the new guest. But are there more guests in the hotel now?

In the 19th century, the great mathematician Georg Cantor cleared away the vagueness around infinity. He found that infinities come in different sizes. Further, he created an exceptionally beautiful and mathematically meaningful theory of transfinite numbers, which we will explore in this article. But before diving into the ocean of infinite infinities, let’s understand a few mathematical terms. (You may skip them.)

## Terminology

**Set:** a set is a finite or infinite collection of elements. Elements can be anything, e.g., numbers, animals, ex-girlfriends, etc. Sets are written in curly braces $\{ \}$, e.g., $A = \{1, 3, 7\}$ is a set. The set with no element in it is called the empty set and is denoted by $\emptyset = \{ \}$.

For the set of **natural numbers**, we start with one and keep adding 1 to it. $\mathbb{N} = \{1, 2, 3, 4, \ldots\}$ is the set of all natural numbers. These numbers are also called counting numbers.

If we add zero and the negatives of the natural numbers, we get the set of **integers**,

$$
\mathbb{Z} = \{\ldots, -3, -2, -1, 0, 1, 2, 3, \ldots\}.
$$

**Rational numbers** are the numbers that can be written as a fraction of two integers (with a denominator other than zero); their decimal expansions either end or repeat forever. For example, $\frac{1}{2}, -\frac{4}{9}, \frac{5}{1}$ and $0.313131\ldots$ are rational numbers. We denote the set of all rational numbers by $\mathbb{Q}$.

There are also numbers that are not rational (e.g., $\sqrt{2}, \pi$), called **irrational numbers**. They can’t be written as a fraction $a/b$ of integers; their decimal expansions go on forever without repeating.

The set of **real numbers** is the union of all the sets described above (the rational and the irrational numbers together), and it is denoted by $\mathbb{R}$.

The number of elements in a set is called the **cardinality** of the set, e.g., $A = \{1, 2, 5, 6\}$ has cardinality 4. And $X <_c Y$ means that $X$ has smaller cardinality than $Y$.

## Pairing & cardinality

Let’s think about what it means for two sets to be the same size, or to have the same cardinality. Suppose we are in a packed auditorium, where every seat is taken and no one is standing. Then we know there are as many people in the audience as there are chairs, even though we don’t know how many of either there are. Similarly, a farmer who doesn’t know how to count can quickly find out whether he owns more cows than his neighbour, by pairing off his cows with his neighbour’s. So we don’t need to count the elements of two sets to compare their sizes: we just pair off their elements. If one of the sets runs out first, it has fewer elements than the other; otherwise both sets have the same number of elements.

We make this pairing precise with functions. What is a function? A function $f$ from a set $X$ to a set $Y$ maps every element of $X$ to exactly one element of $Y$. We write $f : X \to Y$.

*Example:* consider a class with 4 boys and 4 girls. Let $B = \{b_1, b_2, b_3, b_4\}$ be the set of boys and $G = \{g_1, g_2, g_3, g_4\}$ the set of girls. We describe who has a crush on whom with the diagrams below: if the boy $b_1$ has a crush on the girl $g_1$, we draw an arrow from $b_1$ to $g_1$. Which of these crush relations are functions?

![Figure 1: Crush relations](fig-crush-relations.svg)

Here, $f_2$ is not a function, because $b_2$ is not mapped to any element of $G$. And $f_4$ is not a function, because $b_2$ has a crush on two girls, i.e. $b_2$ is mapped to more than one girl, which is not allowed! $f_1$ and $f_3$ are functions, as they follow the definition.

Further, we say that a function $f : X \to Y$ is **onto** (surjective) if every element of $Y$ is the image of at least one element of $X$. It is **one-to-one** (injective) if every element of $Y$ is the image of at most one element of $X$, that is, different elements of $X$ are mapped to different elements of $Y$. And $f$ is **bijective** (a bijection) if it is both onto and one-to-one. $f_1$ in Figure 1 is a bijection.

Now, knowing whether a function is onto, one-to-one or bijective, can we compare the sizes of two sets? Yes, we can! Suppose that in the class, the crush relation from boys to girls is a function: every boy has a crush on exactly one girl. If this function is onto (every girl has at least one boy who has a crush on her), then which is larger, the set of boys or the set of girls? Also work it out for one-to-one functions and for bijections. From $f_1$ in Figure 1 you can see that two sets have the same cardinality if there is a bijection between them.

These examples are about finite sets. But infinite sets follow the same logic, even if pairing off infinite sets is a counter-intuitive idea.

## Countable & uncountable

We say a set is **countable** if we can count, or list, all of its elements as the first, the second, the third, and so on. Every finite set is countable. An infinite set can be countable too; then the counting never stops. For example, in $\mathbb{N} = \{1, 2, 3, \ldots\}$ the counting goes on forever, but we can still list all the elements of the set.

Mathematically, an infinite set $A$ is countable if there is a bijection from $\mathbb{N}$ to $A$. That is the same as saying that $A$ has the same cardinality as the natural numbers. If there is an onto function $f : \mathbb{N} \to A$, or a one-to-one function $f : A \to \mathbb{N}$, then the infinite set $A$ has the same cardinality as $\mathbb{N}$ (find out why!). It follows that every subset of a countable set is countable. A set that is not countable is called **uncountable**.

Now, back to our first question: are there more natural numbers than even numbers? Consider the function $f$ from $\mathbb{N}$ to the set of all even numbers given by $f(n) = 2n$. Every even number $m$ is $f(n)$ for the natural number $n = m/2$, so $f$ is onto. And different natural numbers have different doubles ($2n = 2k$ only when $n = k$), so $f$ is one-to-one. Hence $f$ is a bijection, which means there are exactly as many even numbers as natural numbers.

Surprisingly, the set of all rational numbers, $\mathbb{Q}$, has the same cardinality as the set of all natural numbers, $\mathbb{N}$. That is, we can list all the rational numbers! It’s a simple trick. We build the list as follows.

![Figure 2: Enumeration of $\mathbb{Q}$](fig-rationals.svg)

We start with 0 (i.e., $\frac{0}{1}$) as the first element of our list, and walk through the diagram above as shown by the arrows. After 0 comes $\frac{1}{1}$ (i.e., 1): we include 1 in our list, so 1 is the second number on our list. Next we move to $\frac{-1}{1}$ (i.e., $-1$), and we include it too. Next comes $\frac{0}{1}$ (i.e., 0), but we have already listed 0, so we move on. The next numbers, $\frac{-1}{-1}$ (i.e., 1) and $\frac{1}{-1}$ (i.e., $-1$), are already on the list, so we skip ahead. Next comes $\frac{1}{-2}$ (i.e., $-\frac{1}{2}$). This number is not on the list yet, so we include it. And so on. The list will look like

$$
\mathbb{Q} = \{\frac{0}{1}, \frac{1}{1}, -\frac{1}{1}, -\frac{1}{2}, \frac{1}{2}, \frac{2}{1}, -\frac{2}{1}, -\frac{2}{3}, -\frac{1}{3}, \frac{1}{3}, \frac{2}{3}, \frac{3}{2}, \ldots\}
$$

In this way, we can list all the rational numbers exactly once. So the rational numbers are countable. One can also prove this with an onto function $f : \mathbb{N} \to \mathbb{Q}$: for any natural numbers $a$ and $b$, let $f(2^a3^b) = \frac{a}{b}$ and $f(5^a7^b) = -\frac{a}{b}$, and let $f(n) = 0$ for every other natural number $n$. (Any four different prime numbers would do instead of 2, 3, 5 and 7: primes make sure that every number has at most one such form. With $3^a4^b$ in place of $5^a7^b$, for example, the number $12 = 2^2\cdot 3 = 3\cdot 4$ would be sent both to 2 and to $-1$, and $f$ would not be a function.)

**Real numbers:** is the set of all real numbers countable? Let’s suppose the set $\mathbb{R}$ is countable. Then all its subsets must be countable. Now consider the following subset of $\mathbb{R}$:

$$
A = \{ x \in (0, 1) : \text{the decimal expansion of } x \text{ goes on forever and uses only the digits } 1 \text{ and } 2 \}
$$

(Here we have chosen 1 and 2 arbitrarily; any two digits other than 0 and 9 would do. What matters is that no number in $A$ can be written in two ways, as in $0.1999\ldots = 0.2$.)

We have assumed that $\mathbb{R}$ is countable, so the set $A$ must be countable too. Hence we can list all its elements as $\{x_1, x_2, x_3, \ldots\}$, where $x_1, x_2, \ldots$ are elements of $A$.

Now let’s write the numbers in the list $\{x_1, x_2, x_3, \ldots\}$ in decimal notation. For example, let

$$
x_1 = 0.\underline{1}21222211212\ldots
$$

(The digits of $x_1$ go on forever, as they do for every number in $A$.) Let

$$
\begin{gathered}
x_2 = 0.1\underline{2}2112112121\ldots\\
x_3 = 0.11\underline{1}211121222\ldots\\
x_4 = 0.221\underline{1}21212121\ldots\\
\vdots
\end{gathered}
$$

Since $A$ is countable, this list $\{x_1, x_2, x_3, \ldots\}$ must be all of $A$: the enumeration exhausts every number in the set. Can it really do that?

Let’s construct a new number $z$ by the following rule. The first digit of $x_1$ is 1, so we put 2 as the first digit of $z$. The second digit of $x_2$ is 2, so $z$ gets 1 as its second digit. The third digit of $x_3$ is 1, so the third digit of $z$ is 2, and so on. We construct $z$ so that its $n$th digit is the complement of the $n$th digit of the $n$th number in the list (the complement of 1 is 2, and vice versa).

Now $z$ is in the set $A$, as it has the form $0.2122\ldots$, and $z$ is not equal to $x_1$, because they differ in the first digit. $z$ is not equal to $x_2$ either, because they differ in the second digit. Likewise, for every $n$, $z$ differs from the $n$th number in the list in the $n$th digit. So $z$ is not on the list. In the same way we can build infinitely many numbers that are in $A$ but not in the list $\{x_1, x_2, x_3, \ldots\}$. So no enumeration can cover all the elements of $A$, and this contradicts our assumption that $A$ is countable. So $A$ must be uncountable, and hence the set of all real numbers is uncountable.

## Infinite infinities

In 1891, Cantor came up with his theorem on power sets. This astonishingly magnificent theorem leads to infinitely many different types of infinity. The **power set** of a set is the set of all its subsets.

For example, if $A = \{1, 2, 3\}$, then the power set of $A$ is

$$
\mathcal{P}(A) = \{\emptyset, \{1\}, \{2\}, \{3\}, \{1, 2\}, \{2, 3\}, \{1, 3\}, \{1, 2, 3\}\}
$$

Note that the empty set $\emptyset$ and the set itself are always subsets of a set.

::: theorem

**Cantor’s theorem.** *For any set $X$, the cardinality of $X$ is strictly less than the cardinality of its power set $\mathcal{P}(X)$.*

:::

::: proof

*Proof.* Take any set $X$, and suppose there is an onto function $f : X \to \mathcal{P}(X)$. For each $x$ in $X$, $f(x)$ is an element of $\mathcal{P}(X)$, so $f(x)$ is a subset of $X$, and $x$ either belongs to the subset $f(x)$ or it doesn’t. Now consider the set

$$
A = \{ x \in X : x \notin f(x) \}.
$$

$A$ is a subset of $X$, so $A$ is an element of $\mathcal{P}(X)$. And as $f$ is onto, there is some $x_0$ in $X$ such that $A = f(x_0)$. This $x_0$ either belongs to $f(x_0)$ or it doesn’t.

If $x_0$ belongs to $f(x_0) = A$, then, by the definition of $A$, $x_0$ doesn’t belong to $f(x_0)$, which is a contradiction.

And if $x_0$ doesn’t belong to $f(x_0)$, then, by the definition of $A$, $x_0$ belongs to $A = f(x_0)$, which is again a contradiction.

Hence there can’t be an onto function from $X$ to $\mathcal{P}(X)$. On the other hand, $x \mapsto \{x\}$ pairs off $X$ with a part of $\mathcal{P}(X)$, so $\mathcal{P}(X)$ is at least as large as $X$. In other words, the cardinality of $X$ is strictly less than that of its power set.

:::

Let’s apply this theorem to the set of natural numbers $\mathbb{N}$. The set $\mathcal{P}(\mathbb{N})$ has greater cardinality than $\mathbb{N}$, so $\mathcal{P}(\mathbb{N})$ is an uncountable set. Indeed, $\mathcal{P}(\mathbb{N})$ has the same cardinality as $\mathbb{R}$. And by the same argument again, the set $\mathcal{P}(\mathcal{P}(\mathbb{N}))$ has greater cardinality than $\mathcal{P}(\mathbb{N})$. In this fashion we get larger and larger sets:

$$
\mathbb{N} <_c \mathcal{P}(\mathbb{N}) <_c \mathcal{P}(\mathcal{P}(\mathbb{N})) <_c \cdots
$$

And this unending progression leads to infinitely many different infinities.

Now, let $X$ be the union of all the sets $\mathbb{N}, \mathcal{P}(\mathbb{N}), \mathcal{P}(\mathcal{P}(\mathbb{N})), \ldots$ Then the cardinality of $X$ is greater than that of every set above. We can now proceed with $X$ in the same way, and get a never-ending class of higher and higher cardinalities.

Further mathematical pondering reveals that the infinity of the natural numbers is the smallest infinity: every infinite set contains a countably infinite subset (try it!), so no infinite set is smaller than $\mathbb{N}$. At this point Cantor raised a fascinating problem. Is there an infinite set whose cardinality is different from that of each of the sets obtained so far? In particular, is there an infinite set with cardinality greater than $\mathbb{N}$ but less than $\mathbb{R}$? These turned out to be very challenging problems, and among the most fundamental problems in the whole of mathematics. Cantor conjectured that there is no set $X$ such that $\mathbb{N} <_c X <_c \mathcal{P}(\mathbb{N})$. This conjecture is called the **Continuum Hypothesis** (CH). Its more general form, the **Generalised Continuum Hypothesis** (GCH), states that for any infinite set $X$ there is no set $Y$ such that $X <_c Y <_c \mathcal{P}(X)$. Cantor could prove neither CH nor GCH, and he did not live to see how surprisingly the story ended.

In 1938, the logician Kurt Gödel proved that CH and GCH can’t be disproved from the usual axioms of set theory. He obtained these results by building a model of set theory in which those axioms hold together with CH and GCH. This was one of the first times that metamathematics answered a question of ordinary mathematics in a non-trivial way. But note that Gödel’s result only says that CH and GCH can’t be disproved; it does not say that they can be proved. In 1963, the mathematician Paul Cohen came up with a very powerful technique for building models of set theory, called **forcing**, and showed that CH and GCH can’t be proved either. These two results, by Gödel and by Cohen, are among the greatest results of 20th-century mathematics, and forcing has been particularly useful for proving such consistency results.

Something similar, and equally fascinating, had already happened in geometry in the 19th century. The parallel postulate says that through a point outside a given line, there is exactly one line that never meets the given line. Mathematicians showed that it can be neither proved nor disproved from the other axioms of geometry: there are perfectly consistent geometries in which it fails. Since further discussion of this topic is beyond the scope of this article, we will come back to it another time.

## Suggested reading

- Georg Cantor. *Contributions to the Founding of the Theory of Transfinite Numbers.* Dover Publications Inc., New York, 1992.
- K. Kuratowski and A. Mostowski. *Set Theory.* North-Holland Publishing Company, Amsterdam, New York, Oxford, 1976.
- Paul J. Cohen. *Set Theory and the Continuum Hypothesis.* Dover Publications Inc., New York, 2008.
